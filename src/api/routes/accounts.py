"""Account endpoints"""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.api.deps import get_workspace_id
from src.api.errors import Conflict, NotFound, TransferConflict
from src.api.schemas import AccountCreate, AccountResponse
from src.data.database import get_session
from src.data.models import AccountBalanceCheckpointModel, AccountModel
from src.data.repositories import AccountRepository, TransferPostingsExistError


def _strip_tz(dt: datetime) -> datetime:
    """DB columns are naive UTC (see models._utcnow_naive). Frontend sends
    ISO strings with `Z` suffix (tz-aware). SQLite silently accepts either;
    Postgres will raise or coerce, and mixing tz-aware with our naive columns
    on read triggers `TypeError` in Python comparisons. Strip inbound."""
    if dt.tzinfo is not None:
        return dt.astimezone(tz=None).replace(tzinfo=None)
    return dt


class SetOpeningBalanceRequest(BaseModel):
    """B55 L2: PATCH just the starting_balance without requiring the full
    AccountCreate payload. Used by the import review dialog when we
    derive the anchor from bank-reported balance − sum of imported
    transactions."""
    starting_balance: Decimal


class CreateCheckpointRequest(BaseModel):
    """B55 L3: record a bank-reported balance at a specific date."""
    as_of_date: datetime
    reported_balance: Decimal
    source: str = "manual"  # 'manual' or 'csv_import'
    notes: str | None = None


class CheckpointResponse(BaseModel):
    """B55 L3 checkpoint row. `reported_balance` is `float` to match
    AccountResponse — see the docstring there for the rationale."""
    id: str
    account_id: str
    as_of_date: datetime
    reported_balance: float
    source: str
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReconciliationResponse(BaseModel):
    """Ledgera-computed vs bank-reported balance for an account.

    `diff = computed - reported`. Non-zero means something drifted — the user
    should investigate. Ledgera never auto-corrects; this is diagnostic only.

    `status` is one of:
    - `"reconciled"` — computed matches latest checkpoint within $0.01
    - `"drifted"` — computed disagrees with latest checkpoint
    - `"never_reconciled"` — no checkpoints exist yet; not a green light
    """
    account_id: str
    account_name: str
    latest_checkpoint: CheckpointResponse | None = None
    computed_balance: float
    reported_balance: float | None = None
    diff: float | None = None
    status: str  # "reconciled" | "drifted" | "never_reconciled"

router = APIRouter()


@router.post("", response_model=AccountResponse)
def create_account(
    account: AccountCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new account in the current workspace"""
    db_account = AccountModel(
        workspace_id=workspace_id,
        name=account.name,
        type=account.account_type,
        account_currency=account.currency,
        institution=account.institution,
        starting_balance=account.starting_balance
    )

    repo = AccountRepository(session)
    repo.create(db_account)

    # Freshly created — no postings yet, so balance == starting_balance by
    # definition. Skip the compute_balance query.
    return {
        "id": db_account.id,
        "name": db_account.name,
        "account_type": db_account.type,
        "currency": db_account.account_currency,
        "balance": float(db_account.starting_balance),
        "starting_balance": float(db_account.starting_balance),
        "institution": db_account.institution,
        "created_at": db_account.created_at
    }


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get account by ID (scoped to workspace).

    `balance` = starting_balance + sum(postings). Pre-B55 this endpoint
    returned starting_balance verbatim, which meant the balance never
    reflected imported transactions — an active bug, not just a missing
    feature. `starting_balance` is preserved as a separate field so the
    UI can still show the anchor.
    """
    repo = AccountRepository(session)
    account = repo.read_for_workspace(account_id, workspace_id)

    if not account:
        raise NotFound("Account not found", account_id=account_id)

    computed = repo.compute_balance(account_id)
    return {
        "id": account.id,
        "name": account.name,
        "account_type": account.type,
        "currency": account.account_currency,
        "balance": float(computed),
        "starting_balance": float(account.starting_balance or 0),
        "institution": account.institution,
        "created_at": account.created_at
    }


@router.get("")
def list_accounts(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all accounts in the current workspace with real computed balances."""
    repo = AccountRepository(session)
    accounts = repo.read_by_workspace(workspace_id)
    # One aggregate SQL for the whole workspace instead of N per-account queries.
    balances = repo.compute_balances_by_workspace(workspace_id)

    return [
        {
            "id": acc.id,
            "name": acc.name,
            "account_type": acc.type,
            "currency": acc.account_currency,
            "balance": float(balances.get(acc.id, acc.starting_balance or 0)),
            "starting_balance": float(acc.starting_balance or 0),
            "institution": acc.institution,
            "created_at": acc.created_at
        }
        for acc in accounts
    ]


@router.put("/{account_id}")
def update_account(
    account_id: str,
    account_data: AccountCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update an account (scoped to workspace)"""
    repo = AccountRepository(session)
    account = repo.read_for_workspace(account_id, workspace_id)

    if not account:
        raise NotFound("Account not found", account_id=account_id)

    account.name = account_data.name
    account.type = account_data.account_type
    account.account_currency = account_data.currency
    account.institution = account_data.institution
    account.starting_balance = account_data.starting_balance

    repo.update(account)
    computed = repo.compute_balance(account_id)
    return {
        "id": account.id,
        "name": account.name,
        "account_type": account.type,
        "currency": account.account_currency,
        "balance": float(computed),
        "starting_balance": float(account.starting_balance or 0),
        "institution": account.institution,
        "created_at": account.created_at
    }


@router.patch("/{account_id}/opening-balance", response_model=AccountResponse)
def set_opening_balance(
    account_id: str,
    body: SetOpeningBalanceRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Set only the starting_balance for an account (B55 L2).

    Used by the CSV import dialog to anchor an account to the bank-reported
    balance without requiring the user to type a number. Doesn't touch
    postings — subsequent balance queries return
    `starting_balance + sum(postings)`.
    """
    repo = AccountRepository(session)
    account = repo.read_for_workspace(account_id, workspace_id)
    if not account:
        raise NotFound("Account not found", account_id=account_id)

    account.starting_balance = body.starting_balance
    repo.update(account)

    computed = repo.compute_balance(account_id)
    return {
        "id": account.id,
        "name": account.name,
        "account_type": account.type,
        "currency": account.account_currency,
        "balance": float(computed),
        "starting_balance": float(account.starting_balance or 0),
        "institution": account.institution,
        "created_at": account.created_at
    }


# ─── B55 L3: reconciliation checkpoints ───

@router.post("/{account_id}/reconciliation", response_model=CheckpointResponse)
def create_checkpoint(
    account_id: str,
    body: CreateCheckpointRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Record a bank-reported balance at a specific date for reconciliation."""
    repo = AccountRepository(session)
    account = repo.read_for_workspace(account_id, workspace_id)
    if not account:
        raise NotFound("Account not found", account_id=account_id)

    if body.source not in ("manual", "csv_import"):
        raise Conflict("source must be 'manual' or 'csv_import'", source=body.source)

    checkpoint = AccountBalanceCheckpointModel(
        workspace_id=workspace_id,
        account_id=account_id,
        as_of_date=_strip_tz(body.as_of_date),
        reported_balance=body.reported_balance,
        source=body.source,
        notes=body.notes,
    )
    session.add(checkpoint)
    session.commit()
    return checkpoint


@router.get("/{account_id}/reconciliation", response_model=ReconciliationResponse)
def get_reconciliation(
    account_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Return the latest checkpoint's reported balance vs Ledgera's computed
    balance at the same instant.

    `is_reconciled` = True iff |computed − reported| < 0.01 (cent-level match).
    If there are no checkpoints yet, computed_balance is still returned but
    reported/diff/latest_checkpoint are null and is_reconciled is True (nothing
    to disagree with).
    """
    repo = AccountRepository(session)
    account = repo.read_for_workspace(account_id, workspace_id)
    if not account:
        raise NotFound("Account not found", account_id=account_id)

    latest = session.query(AccountBalanceCheckpointModel).filter(
        AccountBalanceCheckpointModel.account_id == account_id
    ).order_by(
        AccountBalanceCheckpointModel.as_of_date.desc(),
        AccountBalanceCheckpointModel.created_at.desc(),
    ).first()

    if latest is None:
        computed = repo.compute_balance(account_id)
        return {
            "account_id": account_id,
            "account_name": account.name,
            "latest_checkpoint": None,
            "computed_balance": float(computed),
            "reported_balance": None,
            "diff": None,
            # "never_reconciled" — do NOT treat as green. UI should render this
            # distinctly from "reconciled" to prevent hiding drift on unverified
            # accounts.
            "status": "never_reconciled",
        }

    computed_at_checkpoint = repo.compute_balance(account_id, as_of=latest.as_of_date)
    reported = Decimal(str(latest.reported_balance))
    diff = computed_at_checkpoint - reported
    return {
        "account_id": account_id,
        "account_name": account.name,
        "latest_checkpoint": latest,
        "computed_balance": float(computed_at_checkpoint),
        "reported_balance": float(reported),
        "diff": float(diff),
        "status": "reconciled" if abs(diff) < Decimal("0.01") else "drifted",
    }


@router.delete("/{account_id}")
def delete_account(
    account_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete an account (scoped to workspace)"""
    repo = AccountRepository(session)
    account = repo.read_for_workspace(account_id, workspace_id)

    if not account:
        raise NotFound("Account not found", account_id=account_id)

    try:
        repo.delete(account_id)
    except TransferPostingsExistError as exc:
        raise TransferConflict(
            f"Account is part of {exc.count} transfer transaction(s) with other "
            "accounts. Delete those transfers first, then retry.",
            count=exc.count,
        ) from exc
    except IntegrityError as exc:
        raise Conflict(
            "Account has linked records that could not be removed. "
            "Please contact support if this persists."
        ) from exc
    return {"message": "Account deleted"}
