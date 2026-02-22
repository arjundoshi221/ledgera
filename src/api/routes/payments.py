"""Cards & Payment Methods endpoints"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.data.database import get_session
from src.data.repositories import CardRepository, PaymentMethodRepository, AccountRepository
from src.data.models import CardModel, PaymentMethodModel
from src.api.schemas import CardCreate, CardResponse, PaymentMethodCreate, PaymentMethodResponse
from src.api.deps import get_workspace_id

router = APIRouter()


# ── Helpers ──

def _serialize_card(card: CardModel) -> dict:
    """Serialize a card with its auto-created payment method ID."""
    pm_id = None
    if card.payment_method:
        pm_id = card.payment_method.id
    return {
        "id": card.id,
        "account_id": card.account_id,
        "card_name": card.card_name,
        "card_type": card.card_type,
        "card_network": card.card_network,
        "last_four": card.last_four,
        "is_active": card.is_active,
        "payment_method_id": pm_id,
        "created_at": card.created_at.isoformat() if card.created_at else None,
    }


def _serialize_pm(pm: PaymentMethodModel) -> dict:
    """Serialize a payment method."""
    return {
        "id": pm.id,
        "name": pm.name,
        "method_type": pm.method_type,
        "icon": pm.icon,
        "card_id": pm.card_id,
        "linked_account_id": pm.linked_account_id,
        "is_system": pm.is_system,
        "is_active": pm.is_active,
        "created_at": pm.created_at.isoformat() if pm.created_at else None,
    }


# ── Card Endpoints ──

@router.get("/cards")
def get_cards(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all active cards for the workspace."""
    repo = CardRepository(session)
    cards = repo.read_by_workspace(workspace_id)
    return [_serialize_card(c) for c in cards]


@router.post("/cards")
def create_card(
    card: CardCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new card and auto-create its payment method."""
    # Validate account exists in workspace
    account_repo = AccountRepository(session)
    account = account_repo.read_for_workspace(card.account_id, workspace_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {card.account_id} not found in workspace")

    # Validate card_type
    if card.card_type not in ("credit", "debit"):
        raise HTTPException(status_code=400, detail="card_type must be 'credit' or 'debit'")

    # Create the card
    card_repo = CardRepository(session)
    db_card = CardModel(
        workspace_id=workspace_id,
        account_id=card.account_id,
        card_name=card.card_name,
        card_type=card.card_type,
        card_network=card.card_network,
        last_four=card.last_four,
    )
    card_repo.create(db_card)

    # Auto-create payment method for this card
    display_name = card.card_name
    if card.last_four:
        display_name = f"{card.card_name} ****{card.last_four}"

    pm_repo = PaymentMethodRepository(session)
    db_pm = PaymentMethodModel(
        workspace_id=workspace_id,
        name=display_name,
        method_type="card",
        icon="\U0001f4b3",  # credit card emoji
        card_id=db_card.id,
        linked_account_id=card.account_id,
    )
    pm_repo.create(db_pm)

    # Refresh card to load relationship
    session.refresh(db_card)
    return _serialize_card(db_card)


@router.put("/cards/{card_id}")
def update_card(
    card_id: str,
    card: CardCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update a card and sync its payment method."""
    card_repo = CardRepository(session)
    db_card = card_repo.read(card_id)

    if not db_card or db_card.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Card not found")

    # Validate account
    account_repo = AccountRepository(session)
    account = account_repo.read_for_workspace(card.account_id, workspace_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {card.account_id} not found in workspace")

    # Update card fields
    db_card.account_id = card.account_id
    db_card.card_name = card.card_name
    db_card.card_type = card.card_type
    db_card.card_network = card.card_network
    db_card.last_four = card.last_four
    card_repo.update(db_card)

    # Sync payment method
    pm_repo = PaymentMethodRepository(session)
    pm = pm_repo.read_by_card(card_id)
    if pm:
        display_name = card.card_name
        if card.last_four:
            display_name = f"{card.card_name} ****{card.last_four}"
        pm.name = display_name
        pm.linked_account_id = card.account_id
        pm_repo.update(pm)

    session.refresh(db_card)
    return _serialize_card(db_card)


@router.delete("/cards/{card_id}")
def delete_card(
    card_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Soft-delete a card and its payment method."""
    card_repo = CardRepository(session)
    db_card = card_repo.read(card_id)

    if not db_card or db_card.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Card not found")

    # Soft-delete associated payment method
    pm_repo = PaymentMethodRepository(session)
    pm = pm_repo.read_by_card(card_id)
    if pm:
        pm.is_active = False
        pm_repo.update(pm)

    # Soft-delete card
    db_card.is_active = False
    card_repo.update(db_card)

    return {"message": "Card deleted"}


# ── Payment Method Endpoints ──

@router.get("/methods")
def get_payment_methods(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all payment methods for the workspace."""
    repo = PaymentMethodRepository(session)
    methods = repo.read_by_workspace(workspace_id)
    return [_serialize_pm(pm) for pm in methods]


@router.post("/methods")
def create_payment_method(
    pm: PaymentMethodCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a custom payment method."""
    if pm.method_type not in ("digital_wallet", "custom"):
        raise HTTPException(
            status_code=400,
            detail="Only 'digital_wallet' or 'custom' method types can be created manually"
        )

    # Validate linked account if provided
    if pm.linked_account_id:
        account_repo = AccountRepository(session)
        account = account_repo.read_for_workspace(pm.linked_account_id, workspace_id)
        if not account:
            raise HTTPException(status_code=404, detail=f"Account {pm.linked_account_id} not found in workspace")

    repo = PaymentMethodRepository(session)
    db_pm = PaymentMethodModel(
        workspace_id=workspace_id,
        name=pm.name,
        method_type=pm.method_type,
        icon=pm.icon,
        linked_account_id=pm.linked_account_id,
    )
    repo.create(db_pm)

    return _serialize_pm(db_pm)


@router.put("/methods/{method_id}")
def update_payment_method(
    method_id: str,
    pm: PaymentMethodCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update a payment method (non-system, non-card)."""
    repo = PaymentMethodRepository(session)
    db_pm = repo.read(method_id)

    if not db_pm or db_pm.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Payment method not found")

    if db_pm.is_system:
        raise HTTPException(status_code=400, detail="Cannot modify system payment methods")

    if db_pm.card_id:
        raise HTTPException(status_code=400, detail="Card-based payment methods are managed via the cards endpoint")

    # Validate linked account if provided
    if pm.linked_account_id:
        account_repo = AccountRepository(session)
        account = account_repo.read_for_workspace(pm.linked_account_id, workspace_id)
        if not account:
            raise HTTPException(status_code=404, detail=f"Account {pm.linked_account_id} not found in workspace")

    db_pm.name = pm.name
    db_pm.method_type = pm.method_type
    db_pm.icon = pm.icon
    db_pm.linked_account_id = pm.linked_account_id
    repo.update(db_pm)

    return _serialize_pm(db_pm)


@router.delete("/methods/{method_id}")
def delete_payment_method(
    method_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete a payment method (soft-delete). Cannot delete system methods."""
    repo = PaymentMethodRepository(session)
    db_pm = repo.read(method_id)

    if not db_pm or db_pm.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Payment method not found")

    if db_pm.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system payment methods")

    if db_pm.card_id:
        raise HTTPException(status_code=400, detail="Delete the card instead to remove this payment method")

    db_pm.is_active = False
    repo.update(db_pm)

    return {"message": "Payment method deleted"}
