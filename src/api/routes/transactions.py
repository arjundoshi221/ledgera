"""Transaction endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from src.data.database import get_session
from src.data.repositories import TransactionRepository, AccountRepository
from src.data.models import TransactionModel, PostingModel
from src.api.schemas import TransactionCreate, TransactionResponse
from src.domain.ledger import Ledger

router = APIRouter()


@router.post("/", response_model=TransactionResponse)
def create_transaction(
    tx: TransactionCreate,
    session: Session = Depends(get_session)
):
    """Create a new transaction"""
    
    # Verify all accounts exist
    account_repo = AccountRepository(session)
    for posting in tx.postings:
        account = account_repo.read(posting.account_id)
        if not account:
            raise HTTPException(
                status_code=404,
                detail=f"Account {posting.account_id} not found"
            )
    
    # Create transaction
    db_tx = TransactionModel(
        timestamp=tx.timestamp,
        payee=tx.payee,
        memo=tx.memo,
        status=tx.status,
        source=tx.source
    )
    
    # Create postings
    for posting in tx.postings:
        db_posting = PostingModel(
            transaction_id=db_tx.id,
            account_id=posting.account_id,
            amount=posting.amount,
            currency=posting.currency,
            base_amount=posting.amount,  # MVP: assume base is same as native
            fx_rate=posting.fx_rate
        )
        db_tx.postings.append(db_posting)
    
    # Validate balanced
    total_base = sum(p.base_amount for p in db_tx.postings)
    if abs(total_base) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction not balanced: {total_base}"
        )
    
    # Save
    repo = TransactionRepository(session)
    repo.create(db_tx)
    
    return {
        "id": db_tx.id,
        "timestamp": db_tx.timestamp,
        "payee": db_tx.payee,
        "memo": db_tx.memo,
        "status": db_tx.status,
        "source": db_tx.source,
        "created_at": db_tx.created_at
    }


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: UUID,
    session: Session = Depends(get_session)
):
    """Get transaction by ID"""
    repo = TransactionRepository(session)
    tx = repo.read(transaction_id)
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {
        "id": tx.id,
        "timestamp": tx.timestamp,
        "payee": tx.payee,
        "memo": tx.memo,
        "status": tx.status,
        "source": tx.source,
        "created_at": tx.created_at
    }


@router.get("/account/{account_id}")
def get_account_transactions(
    account_id: UUID,
    start_date: datetime = None,
    end_date: datetime = None,
    session: Session = Depends(get_session)
):
    """Get transactions for an account"""
    repo = TransactionRepository(session)
    txs = repo.read_by_account(account_id, start_date, end_date)
    
    return [
        {
            "id": tx.id,
            "timestamp": tx.timestamp,
            "payee": tx.payee,
            "memo": tx.memo,
            "status": tx.status,
            "source": tx.source,
            "created_at": tx.created_at
        }
        for tx in txs
    ]
