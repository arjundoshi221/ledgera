"""Bug report API routes (user-facing)"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.data.database import get_session
from src.data.bug_repository import BugReportRepository
from src.data.repositories import UserRepository
from src.api.deps import get_user_id
from src.services.email_service import send_bug_report_confirmation

logger = logging.getLogger(__name__)

router = APIRouter()

# Constants
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_FILES = 5
ALLOWED_CONTENT_TYPES = {
    "image/png", "image/jpeg", "image/gif",
    "video/mp4", "video/webm", "video/quicktime",
}


# ── Response Schemas ──

class BugReportMediaInfo(BaseModel):
    id: str
    filename: str
    content_type: str
    file_size: int
    created_at: str


class BugReportResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str
    media_count: int
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None


# ── Endpoints ──

@router.post("", response_model=BugReportResponse, status_code=201)
async def create_bug_report(
    title: str = Form(...),
    description: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    """Submit a new bug report with optional media attachments"""
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_FILES} files allowed"
        )

    for f in files:
        if f.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{f.content_type}' not allowed. "
                       f"Accepted: PNG, JPG, GIF, MP4, WebM, MOV"
            )

    repo = BugReportRepository(session)
    report = repo.create(
        user_id=user_id,
        title=title,
        description=description,
    )

    for f in files:
        data = await f.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit"
            )
        repo.add_media(
            bug_report_id=report.id,
            filename=f.filename or "unnamed",
            content_type=f.content_type or "application/octet-stream",
            file_size=len(data),
            file_data=data,
        )

    repo.commit()

    # Send confirmation email (non-blocking)
    try:
        user_repo = UserRepository(session)
        user = user_repo.read(user_id)
        if user and user.email:
            send_bug_report_confirmation(user.email, title, report.id)
    except Exception as e:
        logger.warning("Failed to send bug report confirmation email: %s", str(e))

    return BugReportResponse(
        id=report.id,
        title=report.title,
        description=report.description,
        status=report.status,
        media_count=len(files),
        created_at=report.created_at.isoformat(),
        updated_at=report.updated_at.isoformat(),
        resolved_at=None,
    )


@router.get("", response_model=List[BugReportResponse])
def list_my_bug_reports(
    user_id: str = Depends(get_user_id),
    session: Session = Depends(get_session),
):
    """List the current user's bug reports"""
    repo = BugReportRepository(session)
    reports = repo.list_by_user(user_id)
    return [
        BugReportResponse(
            id=r.id,
            title=r.title,
            description=r.description,
            status=r.status,
            media_count=len(r.media) if r.media else 0,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
            resolved_at=r.resolved_at.isoformat() if r.resolved_at else None,
        )
        for r in reports
    ]
