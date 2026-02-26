"""Admin panel API routes"""

import json
import logging
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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


# ── Bug Reports (Admin) ──

class AdminBugReportListItem(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str] = None
    title: str
    description: str
    status: str
    media_count: int
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None


class AdminBugReportMediaInfo(BaseModel):
    id: str
    filename: str
    content_type: str
    file_size: int
    created_at: str


class AdminBugReportDetail(AdminBugReportListItem):
    media: List[AdminBugReportMediaInfo] = []


class PaginatedBugReportResponse(BaseModel):
    reports: List[AdminBugReportListItem]
    total: int
    offset: int
    limit: int


class UpdateBugStatusRequest(BaseModel):
    status: str


@router.get("/bugs", response_model=PaginatedBugReportResponse)
def list_bug_reports(
    status_filter: Optional[str] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """List all bug reports (admin)"""
    from src.data.bug_repository import BugReportRepository
    from src.data.repositories import UserRepository

    repo = BugReportRepository(session)
    reports, total = repo.list_all(
        status_filter=status_filter,
        offset=offset,
        limit=limit,
    )

    user_repo = UserRepository(session)
    user_cache: dict = {}

    items = []
    for r in reports:
        if r.user_id not in user_cache:
            user = user_repo.read(r.user_id)
            user_cache[r.user_id] = user.email if user else "unknown"
        items.append(AdminBugReportListItem(
            id=r.id,
            user_id=r.user_id,
            user_email=user_cache[r.user_id],
            title=r.title,
            description=r.description,
            status=r.status,
            media_count=len(r.media) if r.media else 0,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
            resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
        ))

    return PaginatedBugReportResponse(
        reports=items, total=total, offset=offset, limit=limit,
    )


@router.get("/bugs/{bug_id}", response_model=AdminBugReportDetail)
def get_bug_report_detail(
    bug_id: str,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Get bug report details with media info (admin)"""
    from src.data.bug_repository import BugReportRepository
    from src.data.repositories import UserRepository

    repo = BugReportRepository(session)
    report = repo.get_by_id(bug_id)
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")

    user_repo = UserRepository(session)
    user = user_repo.read(report.user_id)

    return AdminBugReportDetail(
        id=report.id,
        user_id=report.user_id,
        user_email=user.email if user else "unknown",
        title=report.title,
        description=report.description,
        status=report.status,
        media_count=len(report.media),
        created_at=report.created_at.isoformat(),
        updated_at=report.updated_at.isoformat(),
        resolved_at=report.resolved_at.isoformat() if report.resolved_at else None,
        media=[
            AdminBugReportMediaInfo(
                id=m.id,
                filename=m.filename,
                content_type=m.content_type,
                file_size=m.file_size,
                created_at=m.created_at.isoformat(),
            )
            for m in report.media
        ],
    )


@router.patch("/bugs/{bug_id}")
def update_bug_status(
    bug_id: str,
    body: UpdateBugStatusRequest,
    request: Request,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Update bug report status (admin)"""
    from src.data.bug_repository import BugReportRepository
    from src.data.repositories import UserRepository
    from src.services.email_service import send_bug_report_resolved

    valid_statuses = {'open', 'in_progress', 'resolved'}
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    repo = BugReportRepository(session)
    report = repo.update_status(bug_id, body.status)
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")

    # If resolved, delete media and send email
    if body.status == 'resolved':
        repo.delete_media_for_report(bug_id)

        try:
            user_repo = UserRepository(session)
            user = user_repo.read(report.user_id)
            if user and user.email:
                send_bug_report_resolved(user.email, report.title)
        except Exception:
            pass

    # Audit log
    audit = AuditLogRepository(session)
    audit.create(
        actor_user_id=admin.id,
        action=f"admin.bug.{body.status}",
        target_type="bug_report",
        target_id=bug_id,
        details=json.dumps({"title": report.title, "new_status": body.status}),
        ip_address=_get_client_ip(request),
    )

    return {"message": f"Bug report status updated to {body.status}"}


@router.get("/bugs/{bug_id}/media/{media_id}")
def serve_bug_media(
    request: Request,
    bug_id: str,
    media_id: str,
    token: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    """Serve a media file from a bug report (admin).

    Accepts auth via Authorization header OR ?token= query parameter.
    The query-param path allows fetch() without the Authorization header,
    avoiding CORS preflight issues on cross-origin deployments.
    """
    import os
    from fastapi.responses import Response
    from src.data.bug_repository import BugReportRepository
    from src.data.repositories import UserRepository
    from src.services.auth_service import AuthService

    try:
        # ── Authenticate: header first, then query-param fallback ──
        user_id = getattr(request.state, "user_id", None)

        if not user_id and token:
            secret = os.environ.get("JWT_SECRET", "dev-secret-key-change-in-production")
            auth_svc = AuthService(secret_key=secret)
            result = auth_svc.decode_access_token(token)
            if result:
                user_id = str(result[0])

        if not user_id:
            raise HTTPException(status_code=401, detail="Not authenticated")

        # ── Authorise: must be a non-disabled admin ──
        user_repo = UserRepository(session)
        user = user_repo.read(user_id)
        if not user or not user.is_admin or user.is_disabled:
            raise HTTPException(status_code=403, detail="Admin access required")

        # ── Serve the file ──
        repo = BugReportRepository(session)
        media = repo.get_media(media_id)
        if not media or media.bug_report_id != bug_id:
            raise HTTPException(status_code=404, detail="Media not found")

        file_content = bytes(media.file_data) if media.file_data else b""
        # HTTP headers must be Latin-1 encodable; replace non-ASCII chars
        # (e.g. macOS screenshots use U+202F narrow no-break space before AM/PM)
        safe_filename = media.filename.encode("ascii", "replace").decode("ascii").replace('"', '\\"')

        return Response(
            content=file_content,
            media_type=media.content_type,
            headers={
                "Content-Disposition": f'inline; filename="{safe_filename}"',
                "Content-Length": str(len(file_content)),
                "Cache-Control": "private, max-age=3600",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("serve_bug_media error bug_id=%s media_id=%s: %s", bug_id, media_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to serve media: {str(e)}")


@router.delete("/bugs/{bug_id}")
def delete_bug_report(
    bug_id: str,
    request: Request,
    admin: UserModel = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Permanently delete a bug report and its media (admin)"""
    from src.data.bug_repository import BugReportRepository

    repo = BugReportRepository(session)
    report = repo.get_by_id(bug_id)
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")

    title = report.title
    repo.delete_report(bug_id)

    audit = AuditLogRepository(session)
    audit.create(
        actor_user_id=admin.id,
        action="admin.bug.delete",
        target_type="bug_report",
        target_id=bug_id,
        details=json.dumps({"title": title}),
        ip_address=_get_client_ip(request),
    )

    return {"message": f"Bug report deleted"}
