"""Authentication endpoints"""

import os
import json
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.data.database import get_session
from src.data.repositories import UserRepository, WorkspaceRepository, FundRepository, CategoryRepository, PaymentMethodRepository
from src.data.models import UserModel, WorkspaceModel, FundModel, CategoryModel, PaymentMethodModel
from src.services.auth_service import AuthService
from src.api.deps import get_user_id

router = APIRouter()

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
auth_service = AuthService(secret_key=JWT_SECRET)

CURRENT_TOS_VERSION = "1.0"


# ── Request / Response schemas ──

class SignupRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    date_of_birth: str
    nationalities: List[str]
    tax_residencies: List[str]
    countries_of_interest: List[str] = []
    phone_country_code: str
    phone_number: str
    address_line1: str
    address_line2: str = ""
    address_city: str
    address_state: str = ""
    address_postal_code: str
    address_country: str
    tax_id_number: str = ""
    is_us_person: bool = False
    tos_accepted: bool
    privacy_accepted: bool
    base_currency: str = "USD"


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    access_token: str


class CompleteProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: str
    nationalities: List[str]
    tax_residencies: List[str]
    countries_of_interest: List[str] = []
    phone_country_code: str
    phone_number: str
    address_line1: str
    address_line2: str = ""
    address_city: str
    address_state: str = ""
    address_postal_code: str
    address_country: str
    tax_id_number: str = ""
    is_us_person: bool = False
    tos_accepted: bool
    privacy_accepted: bool
    base_currency: str = "USD"


class AuthResponse(BaseModel):
    user_id: str
    workspace_id: str
    access_token: str
    token_type: str = "bearer"
    profile_completed: bool = True
    is_admin: bool = False


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    workspace_id: str
    date_of_birth: Optional[str] = None
    nationalities: List[str] = []
    tax_residencies: List[str] = []
    countries_of_interest: List[str] = []
    phone_country_code: Optional[str] = None
    phone_number: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_postal_code: Optional[str] = None
    address_country: Optional[str] = None
    tax_id_number: Optional[str] = None
    is_us_person: bool = False
    tos_accepted_at: Optional[str] = None
    privacy_accepted_at: Optional[str] = None
    tos_version: Optional[str] = None
    profile_completed: bool = False
    auth_provider: str = "email"


# ── Helpers ──

def _validate_age(date_of_birth: str):
    """Validate DOB format and enforce 18+ age gate."""
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_of_birth must be in YYYY-MM-DD format"
        )
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 18:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be at least 18 years old to sign up"
        )


def _validate_consent(tos_accepted: bool, privacy_accepted: bool):
    """Validate TOS and privacy consent."""
    if not tos_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms of Service"
        )
    if not privacy_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Privacy Policy"
        )


def _validate_password(password: str):
    """Enforce password policy: min 8 chars, 1 upper, 1 lower, 1 digit."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter"
        )
    if not any(c.islower() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter"
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one digit"
        )


def _create_workspace_and_defaults(session: Session, user_id: str, base_currency: str = "USD"):
    """Create workspace + system resources (fund, category, external account) for a new user."""
    workspace_repo = WorkspaceRepository(session)
    workspace = WorkspaceModel(
        owner_user_id=user_id,
        name="Personal",
        base_currency=base_currency
    )
    workspace = workspace_repo.create(workspace)

    fund_repo = FundRepository(session)
    wc_fund = FundModel(
        workspace_id=workspace.id,
        name="Working Capital",
        emoji="",
        description="Default fund for fixed costs / living expenses",
        allocation_percentage=0,
        is_active=True,
        is_system=True
    )
    fund_repo.create(wc_fund)

    cat_repo = CategoryRepository(session)
    fx_fees_cat = CategoryModel(
        workspace_id=workspace.id,
        name="FX Fees",
        emoji="\U0001f4b1",
        type="expense",
        description="Foreign exchange and transfer fees",
        is_system=True
    )
    cat_repo.create(fx_fees_cat)

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

    # Seed default payment methods
    pm_repo = PaymentMethodRepository(session)
    for name, mtype, icon, is_sys in [
        ("Cash", "cash", "\U0001f4b5", True),
        ("Bank Transfer", "bank_transfer", "\U0001f3e6", True),
        ("GPay", "digital_wallet", "\U0001f4f1", False),
        ("Apple Pay", "digital_wallet", "\U0001f34e", False),
        ("PayPal", "digital_wallet", "\U0001f4b3", False),
    ]:
        pm_repo.create(PaymentMethodModel(
            workspace_id=workspace.id,
            name=name,
            method_type=mtype,
            icon=icon,
            is_system=is_sys,
        ))

    return workspace


def _build_user_response(user, workspace_id: str) -> UserResponse:
    """Build UserResponse from a UserModel."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name or user.display_name or "",
        last_name=user.last_name or "",
        workspace_id=workspace_id,
        date_of_birth=user.date_of_birth,
        nationalities=json.loads(user.nationalities or '[]'),
        tax_residencies=json.loads(user.tax_residencies or '[]'),
        countries_of_interest=json.loads(user.countries_of_interest or '[]'),
        phone_country_code=user.phone_country_code,
        phone_number=user.phone_number,
        address_line1=user.address_line1,
        address_line2=user.address_line2,
        address_city=user.address_city,
        address_state=user.address_state,
        address_postal_code=user.address_postal_code,
        address_country=user.address_country,
        tax_id_number=user.tax_id_number,
        is_us_person=user.is_us_person or False,
        tos_accepted_at=user.tos_accepted_at.isoformat() if user.tos_accepted_at else None,
        privacy_accepted_at=user.privacy_accepted_at.isoformat() if user.privacy_accepted_at else None,
        tos_version=user.tos_version,
        profile_completed=user.profile_completed or False,
        auth_provider=user.auth_provider or "email",
    )


# ── Endpoints ──

@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(
    req: SignupRequest,
    session: Session = Depends(get_session)
):
    """Create a new user and workspace via email/password."""
    user_repo = UserRepository(session)

    existing = user_repo.read_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    _validate_age(req.date_of_birth)
    _validate_consent(req.tos_accepted, req.privacy_accepted)
    _validate_password(req.password)

    now = datetime.utcnow()
    hashed_pwd = auth_service.hash_password(req.password)
    user = UserModel(
        email=req.email,
        hashed_password=hashed_pwd,
        first_name=req.first_name,
        last_name=req.last_name,
        display_name=f"{req.first_name} {req.last_name}",
        date_of_birth=req.date_of_birth,
        nationalities=json.dumps(req.nationalities),
        tax_residencies=json.dumps(req.tax_residencies),
        countries_of_interest=json.dumps(req.countries_of_interest),
        phone_country_code=req.phone_country_code,
        phone_number=req.phone_number,
        address_line1=req.address_line1,
        address_line2=req.address_line2,
        address_city=req.address_city,
        address_state=req.address_state,
        address_postal_code=req.address_postal_code,
        address_country=req.address_country,
        tax_id_number=req.tax_id_number or None,
        is_us_person=req.is_us_person,
        tos_accepted_at=now,
        privacy_accepted_at=now,
        tos_version=CURRENT_TOS_VERSION,
        profile_completed=True,
        auth_provider="email",
    )
    user = user_repo.create(user)

    workspace = _create_workspace_and_defaults(session, user.id, base_currency=req.base_currency)
    token = auth_service.create_access_token(user.id, workspace.id)

    return AuthResponse(
        user_id=str(user.id),
        workspace_id=str(workspace.id),
        access_token=token,
        profile_completed=True,
        is_admin=user.is_admin or False,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    req: LoginRequest,
    session: Session = Depends(get_session)
):
    """Login with email and password."""
    user_repo = UserRepository(session)
    user = user_repo.read_by_email(req.email)

    if not user or not user.hashed_password or not auth_service.verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact support."
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

    # Track login analytics
    user.last_login_at = datetime.utcnow()
    user.login_count = (user.login_count or 0) + 1
    user_repo.update(user)

    return AuthResponse(
        user_id=str(user.id),
        workspace_id=str(workspace.id),
        access_token=token,
        profile_completed=user.profile_completed or False,
        is_admin=user.is_admin or False,
    )


@router.post("/google", response_model=AuthResponse)
def google_login(
    req: GoogleLoginRequest,
    session: Session = Depends(get_session)
):
    """Login or signup with Google access token."""
    import requests as http_requests

    # Use the access token to fetch user info from Google
    try:
        resp = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.access_token}"},
            timeout=10,
        )
        if resp.status_code != 200:
            raise ValueError("Invalid token")
        idinfo = resp.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

    email = idinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no email"
        )

    user_repo = UserRepository(session)
    user = user_repo.read_by_email(email)

    if user:
        # Existing user — login
        workspace_repo = WorkspaceRepository(session)
        workspaces = workspace_repo.read_by_owner(user.id)
        if not workspaces:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User has no workspace"
            )
        workspace = workspaces[0]
    else:
        # New user — create with Google info only
        user = UserModel(
            email=email,
            first_name=idinfo.get("given_name", ""),
            last_name=idinfo.get("family_name", ""),
            display_name=idinfo.get("name", ""),
            profile_completed=False,
            auth_provider="google",
        )
        user = user_repo.create(user)
        workspace = _create_workspace_and_defaults(session, user.id)

    if user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact support."
        )

    token = auth_service.create_access_token(user.id, workspace.id)

    # Track login analytics
    user.last_login_at = datetime.utcnow()
    user.login_count = (user.login_count or 0) + 1
    user_repo.update(user)

    return AuthResponse(
        user_id=str(user.id),
        workspace_id=str(workspace.id),
        access_token=token,
        profile_completed=user.profile_completed or False,
        is_admin=user.is_admin or False,
    )


@router.post("/complete-profile", response_model=UserResponse)
def complete_profile(
    req: CompleteProfileRequest,
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session)
):
    """Complete user profile (required after OAuth signup)."""
    user_repo = UserRepository(session)
    user = user_repo.read(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    _validate_age(req.date_of_birth)
    _validate_consent(req.tos_accepted, req.privacy_accepted)

    now = datetime.utcnow()

    if req.first_name:
        user.first_name = req.first_name
    if req.last_name:
        user.last_name = req.last_name
    user.display_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    user.date_of_birth = req.date_of_birth
    user.nationalities = json.dumps(req.nationalities)
    user.tax_residencies = json.dumps(req.tax_residencies)
    user.countries_of_interest = json.dumps(req.countries_of_interest)
    user.phone_country_code = req.phone_country_code
    user.phone_number = req.phone_number
    user.address_line1 = req.address_line1
    user.address_line2 = req.address_line2
    user.address_city = req.address_city
    user.address_state = req.address_state
    user.address_postal_code = req.address_postal_code
    user.address_country = req.address_country
    user.tax_id_number = req.tax_id_number or None
    user.is_us_person = req.is_us_person
    user.tos_accepted_at = now
    user.privacy_accepted_at = now
    user.tos_version = CURRENT_TOS_VERSION
    user.profile_completed = True
    user.updated_at = now

    user = user_repo.update(user)

    workspace_repo = WorkspaceRepository(session)
    workspaces = workspace_repo.read_by_owner(user.id)
    if workspaces and req.base_currency:
        workspaces[0].base_currency = req.base_currency
        workspace_repo.update(workspaces[0])
    workspace_id = str(workspaces[0].id) if workspaces else ""

    return _build_user_response(user, workspace_id)


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

    return _build_user_response(user, workspace_id)
