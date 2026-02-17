"""Transaction endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from src.data.database import get_session
from src.data.repositories import TransactionRepository, AccountRepository
from src.data.models import TransactionModel, PostingModel
from src.api.schemas import TransactionCreate
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
        "category_id": tx.category_id,
        "subcategory_id": tx.subcategory_id,
        "fund_id": tx.fund_id,
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
        fund_id=tx.fund_id
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
