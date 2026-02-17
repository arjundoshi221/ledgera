"""Account endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.data.database import get_session
from src.data.repositories import AccountRepository
from src.data.models import AccountModel
from src.api.schemas import AccountCreate, AccountResponse
from src.api.deps import get_workspace_id

router = APIRouter()


@router.post("/", response_model=AccountResponse)
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
    """Get account by ID (scoped to workspace)"""
    repo = AccountRepository(session)
    account = repo.read_for_workspace(account_id, workspace_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return {
        "id": account.id,
        "name": account.name,
        "account_type": account.type,
        "currency": account.account_currency,
        "balance": float(account.starting_balance or 0),
        "starting_balance": float(account.starting_balance or 0),
        "institution": account.institution,
        "created_at": account.created_at
    }


@router.get("/")
def list_accounts(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all accounts in the current workspace"""
    repo = AccountRepository(session)
    accounts = repo.read_by_workspace(workspace_id)

    return [
        {
            "id": acc.id,
            "name": acc.name,
            "account_type": acc.type,
            "currency": acc.account_currency,
            "balance": float(acc.starting_balance or 0),
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
        raise HTTPException(status_code=404, detail="Account not found")

    account.name = account_data.name
    account.type = account_data.account_type
    account.account_currency = account_data.currency
    account.institution = account_data.institution
    account.starting_balance = account_data.starting_balance

    repo.update(account)
    return {
        "id": account.id,
        "name": account.name,
        "account_type": account.type,
        "currency": account.account_currency,
        "balance": float(account.starting_balance or 0),
        "starting_balance": float(account.starting_balance or 0),
        "institution": account.institution,
        "created_at": account.created_at
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
        raise HTTPException(status_code=404, detail="Account not found")

    repo.delete(account_id)
    return {"message": "Account deleted"}
