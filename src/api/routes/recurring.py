"""Recurring Transactions endpoints"""

from decimal import Decimal
from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.data.database import get_session
from src.data.repositories import RecurringTransactionRepository, TransactionRepository, AccountRepository
from src.data.models import RecurringTransactionModel, TransactionModel, PostingModel, AccountModel, CategoryModel
from src.api.schemas import (
    RecurringTransactionCreate,
    RecurringTransactionUpdate,
    ConfirmRecurringRequest,
    SkipRecurringRequest,
)
from src.api.deps import get_workspace_id

router = APIRouter()

VALID_FREQUENCIES = {"daily", "weekly", "bi_weekly", "monthly", "quarterly", "yearly"}
VALID_TYPES = {"income", "expense", "transfer"}


# ── Helpers ──

def _calculate_next_occurrence(current_date: datetime, frequency: str) -> datetime:
    """Calculate the next occurrence date given a frequency."""
    if frequency == "daily":
        return current_date + timedelta(days=1)
    elif frequency == "weekly":
        return current_date + timedelta(weeks=1)
    elif frequency == "bi_weekly":
        return current_date + timedelta(weeks=2)
    elif frequency == "monthly":
        return current_date + relativedelta(months=1)
    elif frequency == "quarterly":
        return current_date + relativedelta(months=3)
    elif frequency == "yearly":
        return current_date + relativedelta(years=1)
    else:
        raise ValueError(f"Unknown frequency: {frequency}")


def _advance_next_occurrence(template: RecurringTransactionModel, confirmed_occurrence: datetime):
    """Advance next_occurrence past the confirmed occurrence. Deactivate if past end_date."""
    next_date = _calculate_next_occurrence(confirmed_occurrence, template.frequency)
    if template.end_date and next_date > template.end_date:
        template.is_active = False
    template.next_occurrence = next_date


def _generate_pending_instances(template: RecurringTransactionModel, as_of_date: datetime) -> list:
    """Generate all pending instance dicts from template.next_occurrence through as_of_date."""
    instances = []
    current = template.next_occurrence
    while current <= as_of_date:
        if template.end_date and current > template.end_date:
            break
        instances.append({
            "recurring_id": template.id,
            "name": template.name,
            "transaction_type": template.transaction_type,
            "occurrence_date": current.strftime("%Y-%m-%d"),
            "payee": template.payee,
            "memo": template.memo,
            "amount": float(template.amount),
            "currency": template.currency,
            "category_id": template.category_id,
            "subcategory_id": template.subcategory_id,
            "fund_id": template.fund_id,
            "payment_method_id": template.payment_method_id,
            "account_id": template.account_id,
            "from_account_id": template.from_account_id,
            "to_account_id": template.to_account_id,
            "from_currency": template.from_currency,
            "to_currency": template.to_currency,
            "fx_rate": float(template.fx_rate) if template.fx_rate else None,
            "source_fund_id": template.source_fund_id,
            "dest_fund_id": template.dest_fund_id,
            "transfer_fee": float(template.transfer_fee) if template.transfer_fee else None,
            "fee_category_id": template.fee_category_id,
            "frequency": template.frequency,
        })
        current = _calculate_next_occurrence(current, template.frequency)
    return instances


def _serialize_recurring(t: RecurringTransactionModel) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "transaction_type": t.transaction_type,
        "payee": t.payee,
        "memo": t.memo,
        "amount": float(t.amount),
        "currency": t.currency,
        "category_id": t.category_id,
        "subcategory_id": t.subcategory_id,
        "fund_id": t.fund_id,
        "payment_method_id": t.payment_method_id,
        "account_id": t.account_id,
        "from_account_id": t.from_account_id,
        "to_account_id": t.to_account_id,
        "from_currency": t.from_currency,
        "to_currency": t.to_currency,
        "fx_rate": float(t.fx_rate) if t.fx_rate else None,
        "source_fund_id": t.source_fund_id,
        "dest_fund_id": t.dest_fund_id,
        "transfer_fee": float(t.transfer_fee) if t.transfer_fee else None,
        "fee_category_id": t.fee_category_id,
        "frequency": t.frequency,
        "start_date": t.start_date.strftime("%Y-%m-%d") if t.start_date else None,
        "end_date": t.end_date.strftime("%Y-%m-%d") if t.end_date else None,
        "next_occurrence": t.next_occurrence.strftime("%Y-%m-%d") if t.next_occurrence else None,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


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


# ── Endpoints ──

@router.get("")
def list_recurring(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all recurring transaction templates."""
    repo = RecurringTransactionRepository(session)
    templates = repo.read_by_workspace(workspace_id)
    return [_serialize_recurring(t) for t in templates]


@router.post("")
def create_recurring(
    data: RecurringTransactionCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new recurring transaction template."""
    if data.transaction_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"transaction_type must be one of: {VALID_TYPES}")

    if data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"frequency must be one of: {VALID_FREQUENCIES}")

    if data.transaction_type in ("income", "expense") and not data.account_id:
        raise HTTPException(status_code=400, detail="account_id is required for income/expense")

    if data.transaction_type == "transfer":
        if not data.from_account_id or not data.to_account_id:
            raise HTTPException(status_code=400, detail="from_account_id and to_account_id are required for transfers")

    start = datetime.strptime(data.start_date, "%Y-%m-%d")
    end = datetime.strptime(data.end_date, "%Y-%m-%d") if data.end_date else None

    template = RecurringTransactionModel(
        workspace_id=workspace_id,
        name=data.name,
        transaction_type=data.transaction_type,
        payee=data.payee,
        memo=data.memo,
        amount=data.amount,
        currency=data.currency,
        category_id=data.category_id,
        subcategory_id=data.subcategory_id,
        fund_id=data.fund_id,
        payment_method_id=data.payment_method_id,
        account_id=data.account_id,
        from_account_id=data.from_account_id,
        to_account_id=data.to_account_id,
        from_currency=data.from_currency,
        to_currency=data.to_currency,
        fx_rate=data.fx_rate,
        source_fund_id=data.source_fund_id,
        dest_fund_id=data.dest_fund_id,
        transfer_fee=data.transfer_fee,
        fee_category_id=data.fee_category_id,
        frequency=data.frequency,
        start_date=start,
        end_date=end,
        next_occurrence=start,
    )

    repo = RecurringTransactionRepository(session)
    repo.create(template)
    return _serialize_recurring(template)


@router.get("/pending")
def get_pending(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get all pending recurring instances (computed on-the-fly)."""
    repo = RecurringTransactionRepository(session)
    now = datetime.utcnow()
    templates = repo.read_pending(workspace_id, now)

    all_instances = []
    for template in templates:
        all_instances.extend(_generate_pending_instances(template, now))

    all_instances.sort(key=lambda x: x["occurrence_date"])
    return all_instances


@router.put("/{recurring_id}")
def update_recurring(
    recurring_id: str,
    data: RecurringTransactionUpdate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update a recurring transaction template."""
    repo = RecurringTransactionRepository(session)
    template = repo.read(recurring_id)

    if not template or template.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    if data.frequency is not None and data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"frequency must be one of: {VALID_FREQUENCIES}")

    # Apply partial updates
    for field in [
        "name", "payee", "memo", "amount", "currency",
        "category_id", "subcategory_id", "fund_id", "payment_method_id",
        "account_id", "from_account_id", "to_account_id",
        "from_currency", "to_currency", "fx_rate",
        "source_fund_id", "dest_fund_id", "transfer_fee", "fee_category_id",
        "frequency", "is_active",
    ]:
        value = getattr(data, field, None)
        if value is not None:
            setattr(template, field, value)

    if data.end_date is not None:
        template.end_date = datetime.strptime(data.end_date, "%Y-%m-%d") if data.end_date else None

    repo.update(template)
    return _serialize_recurring(template)


@router.delete("/{recurring_id}")
def delete_recurring(
    recurring_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete a recurring transaction template."""
    repo = RecurringTransactionRepository(session)
    template = repo.read(recurring_id)

    if not template or template.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    template.is_active = False
    repo.update(template)
    return {"message": "Recurring transaction deleted"}


@router.post("/{recurring_id}/confirm")
def confirm_recurring(
    recurring_id: str,
    body: ConfirmRecurringRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Confirm a pending recurring instance -- creates a real transaction."""
    repo = RecurringTransactionRepository(session)
    template = repo.read(recurring_id)

    if not template or template.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    if not template.is_active:
        raise HTTPException(status_code=400, detail="Recurring transaction is not active")

    occurrence = datetime.strptime(body.occurrence_date, "%Y-%m-%d")

    # Validate occurrence matches next_occurrence
    expected_date = template.next_occurrence.strftime("%Y-%m-%d")
    if body.occurrence_date != expected_date:
        raise HTTPException(
            status_code=400,
            detail=f"Must confirm in order. Expected {expected_date}, got {body.occurrence_date}"
        )

    # Apply overrides
    amount = body.amount_override if body.amount_override is not None else template.amount
    payee = body.payee_override or template.payee
    memo_val = body.memo_override or template.memo

    tx_repo = TransactionRepository(session)

    if template.transaction_type in ("income", "expense"):
        # Find External account
        external_acc = session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id,
            AccountModel.name == "External"
        ).first()
        if not external_acc:
            raise HTTPException(status_code=500, detail="External account not found")

        if template.transaction_type == "income":
            postings = [
                PostingModel(
                    account_id=template.account_id, amount=amount,
                    posting_currency=template.currency, fx_rate_to_base=Decimal(1), base_amount=amount,
                ),
                PostingModel(
                    account_id=external_acc.id, amount=-amount,
                    posting_currency=template.currency, fx_rate_to_base=Decimal(1), base_amount=-amount,
                ),
            ]
        else:  # expense
            postings = [
                PostingModel(
                    account_id=template.account_id, amount=-amount,
                    posting_currency=template.currency, fx_rate_to_base=Decimal(1), base_amount=-amount,
                ),
                PostingModel(
                    account_id=external_acc.id, amount=amount,
                    posting_currency=template.currency, fx_rate_to_base=Decimal(1), base_amount=amount,
                ),
            ]

        db_tx = TransactionModel(
            workspace_id=workspace_id,
            timestamp=occurrence,
            payee=payee,
            memo=memo_val,
            status="unreconciled",
            source="recurring",
            category_id=template.category_id,
            subcategory_id=template.subcategory_id,
            fund_id=template.fund_id,
            payment_method_id=template.payment_method_id,
        )
        db_tx.postings = postings
        tx_repo.create(db_tx)

    elif template.transaction_type == "transfer":
        fx = template.fx_rate or Decimal(1)
        to_currency = template.to_currency or template.from_currency or template.currency
        from_currency = template.from_currency or template.currency
        received = amount * fx

        db_tx = TransactionModel(
            workspace_id=workspace_id,
            timestamp=occurrence,
            payee=payee or "Transfer",
            memo=memo_val,
            status="unreconciled",
            source="recurring",
            type="transfer",
            source_fund_id=template.source_fund_id,
            dest_fund_id=template.dest_fund_id,
            payment_method_id=template.payment_method_id,
        )

        from_posting = PostingModel(
            account_id=template.from_account_id,
            amount=-amount,
            posting_currency=from_currency,
            fx_rate_to_base=Decimal(1),
            base_amount=-amount,
        )
        to_fx_rate = Decimal(1) / fx if fx != 0 else Decimal(1)
        to_posting = PostingModel(
            account_id=template.to_account_id,
            amount=received,
            posting_currency=to_currency,
            fx_rate_to_base=to_fx_rate,
            base_amount=amount,
        )
        db_tx.postings = [from_posting, to_posting]
        tx_repo.create(db_tx)

        # Handle transfer fee
        if template.transfer_fee and template.transfer_fee > 0:
            external_acc = session.query(AccountModel).filter(
                AccountModel.workspace_id == workspace_id,
                AccountModel.name == "External"
            ).first()

            fee_category_id = template.fee_category_id
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
                    timestamp=occurrence,
                    payee="Transfer Fee",
                    memo=f"Fee for recurring transfer: {template.name}",
                    status="unreconciled",
                    source="recurring",
                    fund_id=template.source_fund_id,
                    category_id=fee_category_id,
                )
                fee_from = PostingModel(
                    account_id=template.from_account_id,
                    amount=-template.transfer_fee,
                    posting_currency=from_currency,
                    fx_rate_to_base=Decimal(1),
                    base_amount=-template.transfer_fee,
                )
                fee_ext = PostingModel(
                    account_id=external_acc.id,
                    amount=template.transfer_fee,
                    posting_currency=from_currency,
                    fx_rate_to_base=Decimal(1),
                    base_amount=template.transfer_fee,
                )
                fee_tx.postings = [fee_from, fee_ext]
                tx_repo.create(fee_tx)

    # Advance next_occurrence
    _advance_next_occurrence(template, occurrence)
    repo.update(template)

    return {
        "transaction": _serialize_tx(db_tx),
        "next_occurrence": template.next_occurrence.strftime("%Y-%m-%d") if template.is_active else None,
    }


@router.post("/{recurring_id}/skip")
def skip_recurring(
    recurring_id: str,
    body: SkipRecurringRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Skip a pending recurring instance without creating a transaction."""
    repo = RecurringTransactionRepository(session)
    template = repo.read(recurring_id)

    if not template or template.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    if not template.is_active:
        raise HTTPException(status_code=400, detail="Recurring transaction is not active")

    occurrence = datetime.strptime(body.occurrence_date, "%Y-%m-%d")

    expected_date = template.next_occurrence.strftime("%Y-%m-%d")
    if body.occurrence_date != expected_date:
        raise HTTPException(
            status_code=400,
            detail=f"Must skip in order. Expected {expected_date}, got {body.occurrence_date}"
        )

    _advance_next_occurrence(template, occurrence)
    repo.update(template)

    return {
        "message": "Skipped",
        "next_occurrence": template.next_occurrence.strftime("%Y-%m-%d") if template.is_active else None,
    }
