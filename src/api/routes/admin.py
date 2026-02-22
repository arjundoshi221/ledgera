"""Admin panel API routes"""

import json
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.data.database import get_session
from src.data.models import UserModel
from src.data.admin_repository import AdminRepository
from src.data.audit_repository import AuditLogRepository
from src.api.admin_deps import require_admin

router = APIRouter()


# ── Response Schemas ──

class AdminUserListItem(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    auth_provider: str
    profile_completed: bool
    is_admin: bool
    is_disabled: bool
    address_country: Optional[str] = None
    created_at: str
    last_login_at: Optional[str] = None
    login_count: int = 0


class WorkspaceStats(BaseModel):
    workspace_id: str
    workspace_name: str
    base_currency: str
    transaction_count: int
    account_count: int
    created_at: Optional[str] = None


class AdminUserDetail(AdminUserListItem):
    date_of_birth: Optional[str] = None
    nationalities: List[str] = []
    tax_residencies: List[str] = []
    phone_country_code: Optional[str] = None
    phone_number: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_postal_code: Optional[str] = None
    workspaces: List[WorkspaceStats] = []


class PaginatedUserResponse(BaseModel):
    users: List[AdminUserListItem]
    total: int
    offset: int
    limit: int


class SystemStatsResponse(BaseModel):
    total_users: int
    total_workspaces: int
    total_transactions: int
    total_accounts: int
    active_users: int
    admin_users: int


class TimeSeriesPoint(BaseModel):
    date: Optional[str] = None
    month: Optional[str] = None
    count: int


class AuthProviderBreakdown(BaseModel):
    provider: str
    count: int


class RetentionCohort(BaseModel):
    cohort: str
    total: int
    retained: int
    retention_rate: float


class ConversionFunnel(BaseModel):
    total_signups: int
    profile_completed: int
    active_users: int
    signup_to_profile_rate: float
    profile_to_active_rate: float
    signup_to_active_rate: float


class FeatureAdoptionItem(BaseModel):
    count: int
    rate: float


class FeatureAdoption(BaseModel):
    projections: FeatureAdoptionItem
    custom_funds: FeatureAdoptionItem
    recurring_transactions: FeatureAdoptionItem


class AuditLogEntry(BaseModel):
    id: str
    actor_user_id: str
    actor_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: str


class PaginatedAuditLogResponse(BaseModel):
    logs: List[AuditLogEntry]
    total: int
    offset: int
    limit: int


# ── Helpers ──

def _get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _user_to_list_item(user: UserModel) -> AdminUserListItem:
    return AdminUserListItem(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        auth_provider=user.auth_provider or "email",
        profile_completed=user.profile_completed or False,
        is_admin=user.is_admin or False,
        is_disabled=user.is_disabled or False,
        address_country=user.address_country,
        created_at=user.created_at.isoformat() if user.created_at else "",
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        login_count=user.login_count or 0,
    )


# ── Dashboard / Overview ──

@router.get("/stats", response_model=SystemStatsResponse)
def get_system_stats(
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Get system-wide statistics"""
    repo = AdminRepository(session)
    return repo.get_system_stats()


@router.get("/growth/signups", response_model=List[TimeSeriesPoint])
def get_signup_growth(
    days: int = Query(default=90, ge=7, le=365),
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Daily signup counts"""
    repo = AdminRepository(session)
    return repo.get_signups_by_period(days)


@router.get("/growth/dau", response_model=List[TimeSeriesPoint])
def get_daily_active_users(
    days: int = Query(default=30, ge=7, le=365),
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Daily active users"""
    repo = AdminRepository(session)
    return repo.get_dau(days)


@router.get("/growth/mau", response_model=List[TimeSeriesPoint])
def get_monthly_active_users(
    months: int = Query(default=12, ge=1, le=36),
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Monthly active users"""
    repo = AdminRepository(session)
    return repo.get_mau(months)


# ── User Management ──

@router.get("/users", response_model=PaginatedUserResponse)
def list_users(
    search: Optional[str] = None,
    auth_provider: Optional[str] = None,
    is_admin: Optional[bool] = None,
    is_disabled: Optional[bool] = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """List all users with search and filters"""
    repo = AdminRepository(session)
    users, total = repo.list_users(
        search=search, auth_provider=auth_provider,
        is_admin=is_admin, is_disabled=is_disabled,
        offset=offset, limit=limit,
    )
    return PaginatedUserResponse(
        users=[_user_to_list_item(u) for u in users],
        total=total, offset=offset, limit=limit,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user_detail(
    user_id: str,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Get detailed user info (never includes password)"""
    repo = AdminRepository(session)
    user = repo.get_user_detail(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ws_stats = repo.get_user_workspace_stats(user_id)

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        auth_provider=user.auth_provider or "email",
        profile_completed=user.profile_completed or False,
        is_admin=user.is_admin or False,
        is_disabled=user.is_disabled or False,
        address_country=user.address_country,
        created_at=user.created_at.isoformat() if user.created_at else "",
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        login_count=user.login_count or 0,
        date_of_birth=user.date_of_birth,
        nationalities=json.loads(user.nationalities or '[]'),
        tax_residencies=json.loads(user.tax_residencies or '[]'),
        phone_country_code=user.phone_country_code,
        phone_number=user.phone_number,
        address_city=user.address_city,
        address_state=user.address_state,
        address_postal_code=user.address_postal_code,
        workspaces=[WorkspaceStats(**ws) for ws in ws_stats.get("workspaces", [])],
    )


@router.post("/users/{user_id}/disable")
def disable_user(
    user_id: str,
    request: Request,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Disable a user account"""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")

    repo = AdminRepository(session)
    user = repo.disable_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    audit = AuditLogRepository(session)
    audit.create(
        actor_user_id=admin.id,
        action="admin.user.disable",
        target_type="user",
        target_id=user_id,
        details=json.dumps({"email": user.email}),
        ip_address=_get_client_ip(request),
    )
    return {"message": f"User {user.email} disabled"}


@router.post("/users/{user_id}/enable")
def enable_user(
    user_id: str,
    request: Request,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Enable a user account"""
    repo = AdminRepository(session)
    user = repo.enable_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    audit = AuditLogRepository(session)
    audit.create(
        actor_user_id=admin.id,
        action="admin.user.enable",
        target_type="user",
        target_id=user_id,
        details=json.dumps({"email": user.email}),
        ip_address=_get_client_ip(request),
    )
    return {"message": f"User {user.email} enabled"}


@router.post("/users/{user_id}/promote")
def promote_user(
    user_id: str,
    request: Request,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Promote a user to admin"""
    repo = AdminRepository(session)
    user = repo.promote_to_admin(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    audit = AuditLogRepository(session)
    audit.create(
        actor_user_id=admin.id,
        action="admin.user.promote",
        target_type="user",
        target_id=user_id,
        details=json.dumps({"email": user.email}),
        ip_address=_get_client_ip(request),
    )
    return {"message": f"User {user.email} promoted to admin"}


@router.post("/users/{user_id}/demote")
def demote_user(
    user_id: str,
    request: Request,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Remove admin role from a user"""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")

    repo = AdminRepository(session)
    user = repo.demote_from_admin(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    audit = AuditLogRepository(session)
    audit.create(
        actor_user_id=admin.id,
        action="admin.user.demote",
        target_type="user",
        target_id=user_id,
        details=json.dumps({"email": user.email}),
        ip_address=_get_client_ip(request),
    )
    return {"message": f"User {user.email} demoted from admin"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    request: Request,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Permanently delete a user and all their data"""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    repo = AdminRepository(session)
    user = repo.get_user_detail(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    email = user.email
    audit = AuditLogRepository(session)
    audit.create(
        actor_user_id=admin.id,
        action="admin.user.delete",
        target_type="user",
        target_id=user_id,
        details=json.dumps({"email": email}),
        ip_address=_get_client_ip(request),
    )

    repo.delete_user(user_id)
    return {"message": f"User {email} permanently deleted"}


# ── Analytics ──

@router.get("/analytics/auth-providers", response_model=List[AuthProviderBreakdown])
def get_auth_provider_breakdown(
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Auth provider breakdown (email vs Google)"""
    repo = AdminRepository(session)
    return repo.get_auth_provider_breakdown()


@router.get("/analytics/profile-completion")
def get_profile_completion(
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Profile completion rates"""
    repo = AdminRepository(session)
    return repo.get_profile_completion_stats()


@router.get("/analytics/geographic")
def get_geographic_distribution(
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """User geographic distribution"""
    repo = AdminRepository(session)
    return repo.get_geographic_distribution()


@router.get("/analytics/age-breakdown")
def get_age_breakdown(
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """User age distribution by bracket"""
    repo = AdminRepository(session)
    return repo.get_age_breakdown()


@router.get("/analytics/retention", response_model=List[RetentionCohort])
def get_retention_cohorts(
    months: int = Query(default=6, ge=1, le=24),
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Monthly cohort retention"""
    repo = AdminRepository(session)
    return repo.get_retention_cohorts(months)


@router.get("/analytics/funnel", response_model=ConversionFunnel)
def get_conversion_funnel(
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Conversion funnel: signup -> profile -> active"""
    repo = AdminRepository(session)
    return repo.get_conversion_funnel()


@router.get("/analytics/feature-adoption", response_model=FeatureAdoption)
def get_feature_adoption(
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Feature adoption rates"""
    repo = AdminRepository(session)
    data = repo.get_feature_adoption()
    return FeatureAdoption(
        projections=FeatureAdoptionItem(**data["projections"]),
        custom_funds=FeatureAdoptionItem(**data["custom_funds"]),
        recurring_transactions=FeatureAdoptionItem(**data["recurring_transactions"]),
    )


# ── Audit Log ──

@router.get("/audit-logs", response_model=PaginatedAuditLogResponse)
def list_audit_logs(
    action_prefix: Optional[str] = None,
    actor_user_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    days: int = Query(default=30, ge=1, le=365),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """List audit log entries with filters"""
    audit_repo = AuditLogRepository(session)
    logs, total = audit_repo.list_logs(
        action_prefix=action_prefix,
        actor_user_id=actor_user_id,
        target_type=target_type,
        target_id=target_id,
        days=days, offset=offset, limit=limit,
    )

    # Enrich with actor email
    from src.data.repositories import UserRepository
    user_repo = UserRepository(session)
    actor_cache: dict = {}

    entries = []
    for log in logs:
        if log.actor_user_id not in actor_cache:
            actor = user_repo.read(log.actor_user_id)
            actor_cache[log.actor_user_id] = actor.email if actor else "unknown"
        entries.append(AuditLogEntry(
            id=log.id,
            actor_user_id=log.actor_user_id,
            actor_email=actor_cache[log.actor_user_id],
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at.isoformat() if log.created_at else "",
        ))

    return PaginatedAuditLogResponse(
        logs=entries, total=total, offset=offset, limit=limit,
    )
