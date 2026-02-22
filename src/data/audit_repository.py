"""Repository for audit log operations"""

import json
from typing import List, Tuple, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .models import AuditLogModel


class AuditLogRepository:
    """Repository for creating and querying audit log entries"""

    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        actor_user_id: str,
        action: str,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
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
        action_prefix: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        days: int = 30,
        offset: int = 0,
        limit: int = 100,
    ) -> Tuple[List[AuditLogModel], int]:
        """Query audit logs with filters, returns (logs, total_count)"""
        query = self.session.query(AuditLogModel)
        cutoff = datetime.utcnow() - timedelta(days=days)
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
