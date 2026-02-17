"""Authentication endpoints"""

import os
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.data.database import get_session
from src.data.repositories import UserRepository, WorkspaceRepository, FundRepository
from src.data.models import UserModel, WorkspaceModel, FundModel
from src.services.auth_service import AuthService
from src.api.deps import get_user_id

router = APIRouter()

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")
auth_service = AuthService(secret_key=JWT_SECRET)


class SignupRequest(BaseModel):
    email: str
    password: str
    display_name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    user_id: str
    workspace_id: str
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    workspace_id: str


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(
    req: SignupRequest,
    session: Session = Depends(get_session)
):
    """Create a new user and workspace."""
    user_repo = UserRepository(session)

    existing = user_repo.read_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_pwd = auth_service.hash_password(req.password)
    user = UserModel(
        email=req.email,
        hashed_password=hashed_pwd,
        display_name=req.display_name
    )
    user = user_repo.create(user)

    workspace_repo = WorkspaceRepository(session)
    workspace = WorkspaceModel(
        owner_user_id=user.id,
        name="Personal",
        base_currency="SGD"
    )
    workspace = workspace_repo.create(workspace)

    # Auto-create default "Working Capital" fund for fixed costs
    fund_repo = FundRepository(session)
    wc_fund = FundModel(
        workspace_id=workspace.id,
        name="Working Capital",
        emoji="",
        description="Default fund for fixed costs / living expenses",
        allocation_percentage=0,
        is_active=True
    )
    fund_repo.create(wc_fund)

    # Auto-create "External" account for income/expense transactions
    from src.data.repositories import AccountRepository
    from src.data.models import AccountModel
    account_repo = AccountRepository(session)
    external_account = AccountModel(
        workspace_id=workspace.id,
        name="External",
        type="asset",
        account_currency=workspace.base_currency,
        institution="System",
        is_active=True
    )
    account_repo.create(external_account)

    token = auth_service.create_access_token(user.id, workspace.id)

    return AuthResponse(
        user_id=str(user.id),
        workspace_id=str(workspace.id),
        access_token=token
    )


@router.post("/login", response_model=AuthResponse)
def login(
    req: LoginRequest,
    session: Session = Depends(get_session)
):
    """Login with email and password."""
    user_repo = UserRepository(session)
    user = user_repo.read_by_email(req.email)

    if not user or not auth_service.verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    workspace_repo = WorkspaceRepository(session)
    workspaces = workspace_repo.read_by_owner(user.id)

    if not workspaces:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User has no workspace"
        )

    workspace = workspaces[0]
    token = auth_service.create_access_token(user.id, workspace.id)

    return AuthResponse(
        user_id=str(user.id),
        workspace_id=str(workspace.id),
        access_token=token
    )


@router.get("/me", response_model=UserResponse)
def get_me(
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session)
):
    """Get current user profile."""
    user_repo = UserRepository(session)
    user = user_repo.read(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    workspace_repo = WorkspaceRepository(session)
    workspaces = workspace_repo.read_by_owner(user.id)
    workspace_id = str(workspaces[0].id) if workspaces else ""

    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name or "",
        workspace_id=workspace_id
    )
