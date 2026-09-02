"""Repository for audit log operations"""

import json
from datetime import timedelta

from sqlalchemy.orm import Session

from .models import AuditLogModel, _utcnow_naive


class AuditLogRepository:
    """Repository for creating and querying audit log entries"""

    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        actor_user_id: str,
        action: str,
        target_type: str | None = None,
        target_id: str | None = None,
        details: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLogModel:
        """Create an audit log entry"""
        entry = AuditLogModel(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details if isinstance(details, str) else json.dumps(details) if details else None,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.session.add(entry)
        self.session.commit()
        return entry

    def list_logs(
        self,
        action_prefix: str | None = None,
        actor_user_id: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        days: int = 30,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[AuditLogModel], int]:
        """Query audit logs with filters, returns (logs, total_count)"""
        query = self.session.query(AuditLogModel)
        cutoff = _utcnow_naive() - timedelta(days=days)
        query = query.filter(AuditLogModel.created_at >= cutoff)

        if action_prefix:
            query = query.filter(AuditLogModel.action.like(f"{action_prefix}%"))
        if actor_user_id:
            query = query.filter(AuditLogModel.actor_user_id == actor_user_id)
        if target_type:
            query = query.filter(AuditLogModel.target_type == target_type)
        if target_id:
            query = query.filter(AuditLogModel.target_id == target_id)

        total = query.count()
        logs = query.order_by(AuditLogModel.created_at.desc()).offset(offset).limit(limit).all()
        return logs, total
