"""Transaction endpoints"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from src.data.database import get_session
from src.data.repositories import TransactionRepository, AccountRepository
from src.data.models import TransactionModel, PostingModel, FundAccountLinkModel, FundModel, AccountModel, CategoryModel
from src.api.schemas import TransactionCreate, TransferCreate
from src.api.deps import get_workspace_id

router = APIRouter()


@router.get("/")
def get_all_transactions(
    workspace_id: str = Depends(get_workspace_id),
    start_date: datetime = None,
    end_date: datetime = None,
    session: Session = Depends(get_session)
):
    """Get all transactions for the workspace (no duplicates)"""
    query = session.query(TransactionModel).filter(
        TransactionModel.workspace_id == workspace_id
    )

    if start_date:
        query = query.filter(TransactionModel.timestamp >= start_date)
    if end_date:
        query = query.filter(TransactionModel.timestamp <= end_date)

    txs = query.order_by(TransactionModel.timestamp.desc()).all()

    return [_serialize_tx(tx) for tx in txs]


def _serialize_tx(tx: TransactionModel) -> dict:
    """Serialize a transaction with its postings."""
    return {
        "id": tx.id,
        "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
        "payee": tx.payee,
        "memo": tx.memo,
        "status": tx.status,
        "type": tx.type,
        "category_id": tx.category_id,
        "subcategory_id": tx.subcategory_id,
        "fund_id": tx.fund_id,
        "source_fund_id": tx.source_fund_id,
        "dest_fund_id": tx.dest_fund_id,
        "payment_method_id": tx.payment_method_id,
        "postings": [
            {
                "account_id": p.account_id,
                "amount": float(p.amount),
                "currency": p.posting_currency,
                "fx_rate": float(p.fx_rate_to_base),
            }
            for p in tx.postings
        ],
    }


@router.post("/")
def create_transaction(
    tx: TransactionCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new transaction with double-entry postings"""
    account_repo = AccountRepository(session)

    # Verify all accounts exist and belong to this workspace
    for posting in tx.postings:
        account = account_repo.read_for_workspace(str(posting.account_id), workspace_id)
        if not account:
            raise HTTPException(
                status_code=404,
                detail=f"Account {posting.account_id} not found in workspace"
            )

    # Create transaction
    db_tx = TransactionModel(
        workspace_id=workspace_id,
        timestamp=tx.timestamp,
        payee=tx.payee,
        memo=tx.memo,
        status=tx.status,
        source=tx.source,
        category_id=tx.category_id,
        subcategory_id=tx.subcategory_id,
        fund_id=tx.fund_id,
        payment_method_id=tx.payment_method_id
    )

    # Create postings
    for posting in tx.postings:
        db_posting = PostingModel(
            account_id=str(posting.account_id),
            amount=posting.amount,
            posting_currency=posting.currency,
            base_amount=posting.amount,  # MVP: assume base currency = posting currency
            fx_rate_to_base=posting.fx_rate
        )
        db_tx.postings.append(db_posting)

    # Validate balanced
    total_base = sum(float(p.base_amount) for p in db_tx.postings)
    if abs(total_base) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction not balanced: {total_base}"
        )

    # Save
    repo = TransactionRepository(session)
    repo.create(db_tx)

    return _serialize_tx(db_tx)


def _auto_detect_fund(session: Session, account_id: str, workspace_id: str) -> Optional[str]:
    """If an account is linked to exactly one active fund, return that fund_id."""
    links = session.query(FundAccountLinkModel).join(
        FundModel, FundAccountLinkModel.fund_id == FundModel.id
    ).filter(
        FundAccountLinkModel.account_id == account_id,
        FundModel.workspace_id == workspace_id,
        FundModel.is_active == True
    ).all()

    if len(links) == 1:
        return links[0].fund_id
    return None


@router.post("/transfer")
def create_transfer(
    transfer: TransferCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a transfer transaction between two accounts with fund tracking"""
    account_repo = AccountRepository(session)

    # Validate accounts exist in workspace
    from_account = account_repo.read_for_workspace(transfer.from_account_id, workspace_id)
    if not from_account:
        raise HTTPException(status_code=404, detail=f"From account {transfer.from_account_id} not found")

    to_account = account_repo.read_for_workspace(transfer.to_account_id, workspace_id)
    if not to_account:
        raise HTTPException(status_code=404, detail=f"To account {transfer.to_account_id} not found")

    if transfer.from_account_id == transfer.to_account_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    if transfer.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be positive")

    # Auto-detect funds from account links if not provided
    source_fund_id = transfer.source_fund_id or _auto_detect_fund(session, transfer.from_account_id, workspace_id)
    dest_fund_id = transfer.dest_fund_id or _auto_detect_fund(session, transfer.to_account_id, workspace_id)

    # Currency handling
    to_currency = transfer.to_currency or transfer.from_currency
    fx_rate = transfer.fx_rate
    received_amount = transfer.amount * fx_rate

    # Create transaction
    db_tx = TransactionModel(
        workspace_id=workspace_id,
        timestamp=transfer.timestamp,
        payee=transfer.payee,
        memo=transfer.memo,
        status="unreconciled",
        source="manual",
        type="transfer",
        fund_id=None,
        source_fund_id=source_fund_id,
        dest_fund_id=dest_fund_id,
        category_id=None,
        subcategory_id=None,
        payment_method_id=transfer.payment_method_id,
    )

    # From-posting: money leaves source account (negative)
    from_posting = PostingModel(
        account_id=transfer.from_account_id,
        amount=-transfer.amount,
        posting_currency=transfer.from_currency,
        fx_rate_to_base=Decimal(1),
        base_amount=-transfer.amount,
    )
    db_tx.postings.append(from_posting)

    # To-posting: money enters dest account (positive)
    to_fx_rate_to_base = Decimal(1) / fx_rate if fx_rate != 0 else Decimal(1)
    to_posting = PostingModel(
        account_id=transfer.to_account_id,
        amount=received_amount,
        posting_currency=to_currency,
        fx_rate_to_base=to_fx_rate_to_base,
        base_amount=transfer.amount,  # In base currency, equals the from amount
    )
    db_tx.postings.append(to_posting)

    # Validate balanced in base currency
    total_base = sum(float(p.base_amount) for p in db_tx.postings)
    if abs(total_base) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transfer not balanced in base currency: {total_base}"
        )

    # Save transfer
    repo = TransactionRepository(session)
    repo.create(db_tx)

    # Create separate fee expense transaction if fee > 0
    fee_tx = None
    if transfer.fee and transfer.fee > 0:
        external_acc = session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id,
            AccountModel.name == "External"
        ).first()

        # Auto-resolve fee category: use provided ID, or fall back to system "FX Fees"
        fee_category_id = transfer.fee_category_id
        if not fee_category_id:
            fx_fees_cat = session.query(CategoryModel).filter(
                CategoryModel.workspace_id == workspace_id,
                CategoryModel.name == "FX Fees",
                CategoryModel.is_system == True
            ).first()
            if fx_fees_cat:
                fee_category_id = fx_fees_cat.id

        if external_acc:
            fee_tx = TransactionModel(
                workspace_id=workspace_id,
                timestamp=transfer.timestamp,
                payee="Transfer Fee",
                memo=f"FX fee for transfer to {to_account.name}" if to_account else "Transfer fee",
                status="unreconciled",
                source="manual",
                type=None,
                fund_id=source_fund_id,
                source_fund_id=None,
                dest_fund_id=None,
                category_id=fee_category_id,
                subcategory_id=None,
            )
            fee_from = PostingModel(
                account_id=transfer.from_account_id,
                amount=-transfer.fee,
                posting_currency=transfer.from_currency,
                fx_rate_to_base=Decimal(1),
                base_amount=-transfer.fee,
            )
            fee_tx.postings.append(fee_from)
            fee_ext = PostingModel(
                account_id=external_acc.id,
                amount=transfer.fee,
                posting_currency=transfer.from_currency,
                fx_rate_to_base=Decimal(1),
                base_amount=transfer.fee,
            )
            fee_tx.postings.append(fee_ext)
            repo.create(fee_tx)

    result = _serialize_tx(db_tx)
    if fee_tx:
        result["fee_transaction"] = _serialize_tx(fee_tx)
    return result


@router.get("/{transaction_id}")
def get_transaction(
    transaction_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get transaction by ID"""
    repo = TransactionRepository(session)
    tx = repo.read(transaction_id)

    if not tx or tx.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return _serialize_tx(tx)


@router.put("/{transaction_id}")
def update_transaction(
    transaction_id: str,
    tx_update: TransactionCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update an existing transaction"""
    repo = TransactionRepository(session)
    tx = repo.read(transaction_id)

    # Verify transaction exists and belongs to workspace
    if not tx or tx.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Transaction not found")

    account_repo = AccountRepository(session)

    # Verify all accounts exist and belong to this workspace
    for posting in tx_update.postings:
        account = account_repo.read_for_workspace(str(posting.account_id), workspace_id)
        if not account:
            raise HTTPException(
                status_code=404,
                detail=f"Account {posting.account_id} not found in workspace"
            )

    # Update transaction fields
    tx.timestamp = tx_update.timestamp
    tx.payee = tx_update.payee
    tx.memo = tx_update.memo
    tx.status = tx_update.status
    tx.category_id = tx_update.category_id
    tx.subcategory_id = tx_update.subcategory_id
    tx.fund_id = tx_update.fund_id
    tx.payment_method_id = tx_update.payment_method_id

    # Delete old postings and create new ones
    tx.postings = []
    session.flush()  # Ensure old postings are deleted

    # Create new postings
    for posting in tx_update.postings:
        db_posting = PostingModel(
            account_id=str(posting.account_id),
            amount=posting.amount,
            posting_currency=posting.currency,
            base_amount=posting.amount,  # MVP: assume base currency = posting currency
            fx_rate_to_base=posting.fx_rate
        )
        tx.postings.append(db_posting)

    # Validate balanced
    total_base = sum(float(p.base_amount) for p in tx.postings)
    if abs(total_base) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction not balanced: {total_base}"
        )

    # Save (update() auto-sets updated_at)
    repo.update(tx)

    return _serialize_tx(tx)


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete a transaction (scoped to workspace)"""
    repo = TransactionRepository(session)
    tx = repo.read(transaction_id)

    if not tx or tx.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Transaction not found")

    repo.delete(transaction_id)
    return {"message": "Transaction deleted"}


@router.get("/account/{account_id}")
def get_account_transactions(
    account_id: str,
    workspace_id: str = Depends(get_workspace_id),
    start_date: datetime = None,
    end_date: datetime = None,
    session: Session = Depends(get_session)
):
    """Get transactions for an account"""
    # Verify account belongs to workspace
    account_repo = AccountRepository(session)
    account = account_repo.read_for_workspace(account_id, workspace_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    repo = TransactionRepository(session)
    txs = repo.read_by_account(account_id, start_date, end_date)

    return [_serialize_tx(tx) for tx in txs]
