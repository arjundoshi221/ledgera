"""Account endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from src.data.database import get_session
from src.data.repositories import AccountRepository
from src.data.models import AccountModel
from src.api.schemas import AccountCreate, AccountResponse

router = APIRouter()


@router.post("/", response_model=AccountResponse)
def create_account(
    account: AccountCreate,
    session: Session = Depends(get_session)
):
    """Create a new account"""
    db_account = AccountModel(
        name=account.name,
        type=account.account_type,
        currency=account.currency,
        institution=account.institution
    )
    
    repo = AccountRepository(session)
    repo.create(db_account)
    
    return {
        "id": db_account.id,
        "name": db_account.name,
        "account_type": db_account.type,
        "currency": db_account.currency,
        "balance": db_account.amount if hasattr(db_account, 'amount') else 0,
        "institution": db_account.institution,
        "created_at": db_account.created_at
    }


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: UUID,
    session: Session = Depends(get_session)
):
    """Get account by ID"""
    repo = AccountRepository(session)
    account = repo.read(account_id)
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {
        "id": account.id,
        "name": account.name,
        "account_type": account.type,
        "currency": account.currency,
        "balance": 0,
        "institution": account.institution,
        "created_at": account.created_at
    }


@router.get("/")
def list_accounts(session: Session = Depends(get_session)):
    """List all accounts"""
    repo = AccountRepository(session)
    accounts = repo.read_all()
    
    return [
        {
            "id": acc.id,
            "name": acc.name,
            "account_type": acc.type,
            "currency": acc.currency,
            "balance": 0,
            "institution": acc.institution,
            "created_at": acc.created_at
        }
        for acc in accounts
    ]
