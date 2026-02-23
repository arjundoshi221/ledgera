"""Repository for bug report operations"""

from typing import List, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session, joinedload

from .models import BugReportModel, BugReportMediaModel


class BugReportRepository:
    """Repository for bug report CRUD and queries"""

    def __init__(self, session: Session):
        self.session = session

    # ── User-facing ──

    def create(
        self,
        user_id: str,
        title: str,
        description: str,
    ) -> BugReportModel:
        report = BugReportModel(
            user_id=user_id,
            title=title,
            description=description,
            status='open',
        )
        self.session.add(report)
        self.session.flush()
        return report

    def add_media(
        self,
        bug_report_id: str,
        filename: str,
        content_type: str,
        file_size: int,
        file_data: bytes,
    ) -> BugReportMediaModel:
        media = BugReportMediaModel(
            bug_report_id=bug_report_id,
            filename=filename,
            content_type=content_type,
            file_size=file_size,
            file_data=file_data,
        )
        self.session.add(media)
        return media

    def commit(self) -> None:
        self.session.commit()

    def list_by_user(self, user_id: str) -> List[BugReportModel]:
        return (
            self.session.query(BugReportModel)
            .options(joinedload(BugReportModel.media))
            .filter(BugReportModel.user_id == user_id)
            .order_by(BugReportModel.created_at.desc())
            .all()
        )

    # ── Admin-facing ──

    def list_all(
        self,
        status_filter: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> Tuple[List[BugReportModel], int]:
        query = self.session.query(BugReportModel).options(
            joinedload(BugReportModel.media)
        )
        if status_filter and status_filter != 'all':
            query = query.filter(BugReportModel.status == status_filter)
        total = query.count()
        reports = (
            query.order_by(BugReportModel.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return reports, total

    def get_by_id(self, report_id: str) -> Optional[BugReportModel]:
        return (
            self.session.query(BugReportModel)
            .options(joinedload(BugReportModel.media))
            .filter(BugReportModel.id == report_id)
            .first()
        )

    def get_media(self, media_id: str) -> Optional[BugReportMediaModel]:
        return (
            self.session.query(BugReportMediaModel)
            .filter(BugReportMediaModel.id == media_id)
            .first()
        )

    def update_status(
        self,
        report_id: str,
        new_status: str,
    ) -> Optional[BugReportModel]:
        report = (
            self.session.query(BugReportModel)
            .filter(BugReportModel.id == report_id)
            .first()
        )
        if not report:
            return None
        report.status = new_status
        report.updated_at = datetime.utcnow()
        if new_status == 'resolved':
            report.resolved_at = datetime.utcnow()
        self.session.commit()
        return report

    def delete_media_for_report(self, report_id: str) -> int:
        count = (
            self.session.query(BugReportMediaModel)
            .filter(BugReportMediaModel.bug_report_id == report_id)
            .delete()
        )
        self.session.commit()
        return count

    def delete_report(self, report_id: str) -> bool:
        report = self.get_by_id(report_id)
        if not report:
            return False
        self.session.delete(report)
        self.session.commit()
        return True
