"""Workspace endpoints"""

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from src.data.database import get_session
from src.data.repositories import WorkspaceRepository
from src.api.deps import get_workspace_id

router = APIRouter()


class WorkspaceResponse(BaseModel):
    id: str
    owner_user_id: str
    name: str
    base_currency: str
    min_wc_balance: float = 0


class WorkspaceUpdateRequest(BaseModel):
    base_currency: Optional[str] = None
    name: Optional[str] = None
    min_wc_balance: Optional[float] = None


@router.get("/workspace", response_model=WorkspaceResponse)
def read_workspace(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get current workspace metadata."""
    workspace_repo = WorkspaceRepository(session)
    workspace = workspace_repo.read(workspace_id)

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    return WorkspaceResponse(
        id=str(workspace.id),
        owner_user_id=str(workspace.owner_user_id),
        name=workspace.name,
        base_currency=workspace.base_currency,
        min_wc_balance=float(workspace.min_wc_balance or 0),
    )


@router.patch("/workspace", response_model=WorkspaceResponse)
def update_workspace(
    req: WorkspaceUpdateRequest,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update workspace settings."""
    workspace_repo = WorkspaceRepository(session)
    workspace = workspace_repo.read(workspace_id)

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )

    if req.base_currency:
        workspace.base_currency = req.base_currency
    if req.name:
        workspace.name = req.name
    if req.min_wc_balance is not None:
        workspace.min_wc_balance = req.min_wc_balance

    workspace = workspace_repo.update(workspace)

    return WorkspaceResponse(
        id=str(workspace.id),
        owner_user_id=str(workspace.owner_user_id),
        name=workspace.name,
        base_currency=workspace.base_currency,
        min_wc_balance=float(workspace.min_wc_balance or 0),
    )
