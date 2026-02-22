"""Repository for admin-level data access (cross-tenant)"""

from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case, String
from sqlalchemy.sql import expression
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.types import Date as DateType

from sqlalchemy import text
from .models import (
    UserModel, WorkspaceModel, TransactionModel,
    AccountModel, ScenarioModel, FundModel, RecurringTransactionModel,
    AuditLogModel,
)


# ── Cross-dialect SQL helpers ──

class _year_month(expression.FunctionElement):
    """Extract 'YYYY-MM' from a datetime column (SQLite + PostgreSQL)."""
    type = String()
    inherit_cache = True

@compiles(_year_month, "sqlite")
def _ym_sqlite(element, compiler, **kw):
    return f"strftime('%%Y-%%m', {compiler.process(element.clauses)})"

@compiles(_year_month, "postgresql")
def _ym_pg(element, compiler, **kw):
    return f"to_char({compiler.process(element.clauses)}, 'YYYY-MM')"


class _to_date(expression.FunctionElement):
    """Truncate a datetime to date (SQLite + PostgreSQL)."""
    type = DateType()
    inherit_cache = True

@compiles(_to_date, "sqlite")
def _td_sqlite(element, compiler, **kw):
    return f"date({compiler.process(element.clauses)})"

@compiles(_to_date, "postgresql")
def _td_pg(element, compiler, **kw):
    return f"({compiler.process(element.clauses)})::date"


class AdminRepository:
    """Cross-tenant repository for admin analytics and user management"""

    def __init__(self, session: Session):
        self.session = session

    # ── User Management ──

    def list_users(
        self,
        search: Optional[str] = None,
        auth_provider: Optional[str] = None,
        is_admin: Optional[bool] = None,
        is_disabled: Optional[bool] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> Tuple[List[UserModel], int]:
        """List all users with search/filter, returns (users, total_count)"""
        query = self.session.query(UserModel)

        if search:
            like_pattern = f"%{search}%"
            query = query.filter(
                (UserModel.email.ilike(like_pattern)) |
                (UserModel.first_name.ilike(like_pattern)) |
                (UserModel.last_name.ilike(like_pattern))
            )
        if auth_provider:
            query = query.filter(UserModel.auth_provider == auth_provider)
        if is_admin is not None:
            query = query.filter(UserModel.is_admin == is_admin)
        if is_disabled is not None:
            query = query.filter(UserModel.is_disabled == is_disabled)

        total = query.count()
        users = query.order_by(UserModel.created_at.desc()).offset(offset).limit(limit).all()
        return users, total

    def get_user_detail(self, user_id: str) -> Optional[UserModel]:
        """Get a single user by ID"""
        return self.session.query(UserModel).filter(UserModel.id == user_id).first()

    def disable_user(self, user_id: str) -> Optional[UserModel]:
        """Disable a user account"""
        user = self.get_user_detail(user_id)
        if user:
            user.is_disabled = True
            user.updated_at = datetime.utcnow()
            self.session.commit()
        return user

    def enable_user(self, user_id: str) -> Optional[UserModel]:
        """Enable a user account"""
        user = self.get_user_detail(user_id)
        if user:
            user.is_disabled = False
            user.updated_at = datetime.utcnow()
            self.session.commit()
        return user

    def promote_to_admin(self, user_id: str) -> Optional[UserModel]:
        """Promote a user to admin"""
        user = self.get_user_detail(user_id)
        if user:
            user.is_admin = True
            user.updated_at = datetime.utcnow()
            self.session.commit()
        return user

    def demote_from_admin(self, user_id: str) -> Optional[UserModel]:
        """Remove admin role from a user"""
        user = self.get_user_detail(user_id)
        if user:
            user.is_admin = False
            user.updated_at = datetime.utcnow()
            self.session.commit()
        return user

    def delete_user(self, user_id: str) -> bool:
        """Permanently delete a user and all their data (workspaces, transactions, etc.)"""
        user = self.get_user_detail(user_id)
        if not user:
            return False

        # Get all workspace IDs owned by this user
        workspace_ids = [
            ws.id for ws in self.session.query(WorkspaceModel.id).filter(
                WorkspaceModel.owner_user_id == user_id
            ).all()
        ]

        if workspace_ids:
            # Delete workspace data bottom-up (children first)
            # Using raw SQL for reliability with SQLite
            for ws_id in workspace_ids:
                p = {"ws": ws_id}
                # Postings (depend on transactions + accounts)
                self.session.execute(text(
                    "DELETE FROM postings WHERE transaction_id IN "
                    "(SELECT id FROM transactions WHERE workspace_id = :ws)"
                ), p)
                # Transaction-tag links
                self.session.execute(text(
                    "DELETE FROM transaction_tags WHERE transaction_id IN "
                    "(SELECT id FROM transactions WHERE workspace_id = :ws)"
                ), p)
                # Transactions
                self.session.execute(text("DELETE FROM transactions WHERE workspace_id = :ws"), p)
                # Recurring transactions
                self.session.execute(text("DELETE FROM recurring_transactions WHERE workspace_id = :ws"), p)
                # Fund allocation overrides
                self.session.execute(text(
                    "DELETE FROM fund_allocation_overrides WHERE fund_id IN "
                    "(SELECT id FROM funds WHERE workspace_id = :ws)"
                ), p)
                # Fund-account links
                self.session.execute(text(
                    "DELETE FROM fund_accounts WHERE fund_id IN "
                    "(SELECT id FROM funds WHERE workspace_id = :ws)"
                ), p)
                # Funds
                self.session.execute(text("DELETE FROM funds WHERE workspace_id = :ws"), p)
                # Cards (depend on accounts)
                self.session.execute(text(
                    "DELETE FROM cards WHERE account_id IN "
                    "(SELECT id FROM accounts WHERE workspace_id = :ws)"
                ), p)
                # Accounts
                self.session.execute(text("DELETE FROM accounts WHERE workspace_id = :ws"), p)
                # Payment methods
                self.session.execute(text("DELETE FROM payment_methods WHERE workspace_id = :ws"), p)
                # Subcategories
                self.session.execute(text(
                    "DELETE FROM subcategories WHERE category_id IN "
                    "(SELECT id FROM categories WHERE workspace_id = :ws)"
                ), p)
                # Categories
                self.session.execute(text("DELETE FROM categories WHERE workspace_id = :ws"), p)
                # Projection results
                self.session.execute(text(
                    "DELETE FROM projection_results WHERE scenario_id IN "
                    "(SELECT id FROM scenarios WHERE workspace_id = :ws)"
                ), p)
                # Projection assumptions
                self.session.execute(text(
                    "DELETE FROM projection_assumptions WHERE scenario_id IN "
                    "(SELECT id FROM scenarios WHERE workspace_id = :ws)"
                ), p)
                # Scenarios
                self.session.execute(text("DELETE FROM scenarios WHERE workspace_id = :ws"), p)

            # Delete workspaces
            self.session.execute(text(
                "DELETE FROM workspaces WHERE owner_user_id = :uid"
            ), {"uid": user_id})

        # Delete audit log entries where this user is the actor
        self.session.execute(text(
            "DELETE FROM audit_logs WHERE actor_user_id = :uid"
        ), {"uid": user_id})

        # Delete the user
        self.session.delete(user)
        self.session.commit()
        return True

    # ── System Overview ──

    def get_system_stats(self) -> dict:
        """Total users, workspaces, transactions, accounts"""
        return {
            "total_users": self.session.query(func.count(UserModel.id)).scalar() or 0,
            "total_workspaces": self.session.query(func.count(WorkspaceModel.id)).scalar() or 0,
            "total_transactions": self.session.query(func.count(TransactionModel.id)).scalar() or 0,
            "total_accounts": self.session.query(func.count(AccountModel.id)).scalar() or 0,
            "active_users": self.session.query(func.count(UserModel.id)).filter(
                UserModel.is_disabled == False  # noqa: E712
            ).scalar() or 0,
            "admin_users": self.session.query(func.count(UserModel.id)).filter(
                UserModel.is_admin == True  # noqa: E712
            ).scalar() or 0,
        }

    # ── Growth Metrics ──

    def get_signups_by_period(self, days: int = 90) -> List[dict]:
        """Daily signup counts for the last N days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        results = self.session.query(
            _to_date(UserModel.created_at).label('date'),
            func.count(UserModel.id).label('count')
        ).filter(
            UserModel.created_at >= cutoff
        ).group_by(
            _to_date(UserModel.created_at)
        ).order_by(
            _to_date(UserModel.created_at)
        ).all()
        return [{"date": str(r.date), "count": r.count} for r in results]

    def get_dau(self, days: int = 30) -> List[dict]:
        """Daily active users (users who logged in) for last N days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        results = self.session.query(
            _to_date(UserModel.last_login_at).label('date'),
            func.count(UserModel.id).label('count')
        ).filter(
            UserModel.last_login_at >= cutoff,
            UserModel.last_login_at.isnot(None)
        ).group_by(
            _to_date(UserModel.last_login_at)
        ).order_by(
            _to_date(UserModel.last_login_at)
        ).all()
        return [{"date": str(r.date), "count": r.count} for r in results]

    def get_mau(self, months: int = 12) -> List[dict]:
        """Monthly active users for the last N months"""
        cutoff = datetime.utcnow() - timedelta(days=months * 31)
        results = self.session.query(
            _year_month(UserModel.last_login_at).label('month'),
            func.count(distinct(UserModel.id)).label('count')
        ).filter(
            UserModel.last_login_at >= cutoff,
            UserModel.last_login_at.isnot(None)
        ).group_by(
            _year_month(UserModel.last_login_at)
        ).order_by(
            _year_month(UserModel.last_login_at)
        ).all()
        return [{"month": r.month, "count": r.count} for r in results]

    # ── User Analytics ──

    def get_auth_provider_breakdown(self) -> List[dict]:
        """Count users by auth_provider (email vs google)"""
        results = self.session.query(
            UserModel.auth_provider,
            func.count(UserModel.id).label('count')
        ).group_by(UserModel.auth_provider).all()
        return [{"provider": r.auth_provider or "email", "count": r.count} for r in results]

    def get_profile_completion_stats(self) -> dict:
        """Profile completed vs incomplete counts"""
        completed = self.session.query(func.count(UserModel.id)).filter(
            UserModel.profile_completed == True  # noqa: E712
        ).scalar() or 0
        incomplete = self.session.query(func.count(UserModel.id)).filter(
            UserModel.profile_completed == False  # noqa: E712
        ).scalar() or 0
        return {"completed": completed, "incomplete": incomplete}

    def get_geographic_distribution(self) -> List[dict]:
        """Users by address_country"""
        results = self.session.query(
            UserModel.address_country,
            func.count(UserModel.id).label('count')
        ).filter(
            UserModel.address_country.isnot(None),
            UserModel.address_country != ''
        ).group_by(UserModel.address_country).order_by(
            func.count(UserModel.id).desc()
        ).all()
        return [{"country": r.address_country, "count": r.count} for r in results]

    def get_age_breakdown(self) -> List[dict]:
        """Age distribution of users in brackets: 18-24, 25-34, 35-44, 45-54, 55-64, 65+"""
        users = self.session.query(UserModel.date_of_birth).filter(
            UserModel.date_of_birth.isnot(None),
            UserModel.date_of_birth != ''
        ).all()

        buckets = {"18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55-64": 0, "65+": 0, "Unknown": 0}
        today = datetime.utcnow().date()

        for (dob_str,) in users:
            try:
                parts = str(dob_str).split("-")
                dob = datetime(int(parts[0]), int(parts[1]), int(parts[2])).date()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < 18:
                    continue
                elif age <= 24:
                    buckets["18-24"] += 1
                elif age <= 34:
                    buckets["25-34"] += 1
                elif age <= 44:
                    buckets["35-44"] += 1
                elif age <= 54:
                    buckets["45-54"] += 1
                elif age <= 64:
                    buckets["55-64"] += 1
                else:
                    buckets["65+"] += 1
            except (ValueError, IndexError):
                buckets["Unknown"] += 1

        return [{"bracket": k, "count": v} for k, v in buckets.items() if v > 0]

    def get_retention_cohorts(self, months: int = 6) -> List[dict]:
        """Monthly cohort retention: signup month vs last_login_at"""
        cutoff = datetime.utcnow() - timedelta(days=months * 31)
        results = self.session.query(
            _year_month(UserModel.created_at).label('cohort'),
            func.count(UserModel.id).label('total'),
            func.count(case(
                (UserModel.last_login_at.isnot(None), UserModel.id),
            )).label('retained'),
        ).filter(
            UserModel.created_at >= cutoff
        ).group_by(
            _year_month(UserModel.created_at)
        ).order_by(
            _year_month(UserModel.created_at)
        ).all()
        return [{
            "cohort": r.cohort,
            "total": r.total,
            "retained": r.retained,
            "retention_rate": round(r.retained / r.total * 100, 1) if r.total > 0 else 0,
        } for r in results]

    # ── Marketing / Conversion Funnel ──

    def get_conversion_funnel(self) -> dict:
        """Signup -> Profile Complete -> Has Transactions (active user)"""
        total_signups = self.session.query(func.count(UserModel.id)).scalar() or 0
        profile_completed = self.session.query(func.count(UserModel.id)).filter(
            UserModel.profile_completed == True  # noqa: E712
        ).scalar() or 0

        users_with_txns = self.session.query(
            func.count(distinct(WorkspaceModel.owner_user_id))
        ).join(
            TransactionModel, TransactionModel.workspace_id == WorkspaceModel.id
        ).scalar() or 0

        return {
            "total_signups": total_signups,
            "profile_completed": profile_completed,
            "active_users": users_with_txns,
            "signup_to_profile_rate": round(profile_completed / total_signups * 100, 1) if total_signups > 0 else 0,
            "profile_to_active_rate": round(users_with_txns / profile_completed * 100, 1) if profile_completed > 0 else 0,
            "signup_to_active_rate": round(users_with_txns / total_signups * 100, 1) if total_signups > 0 else 0,
        }

    def get_feature_adoption(self) -> dict:
        """Count of users using each major feature"""
        total = self.session.query(func.count(UserModel.id)).scalar() or 1

        users_with_scenarios = self.session.query(
            func.count(distinct(WorkspaceModel.owner_user_id))
        ).filter(
            WorkspaceModel.id.in_(
                self.session.query(ScenarioModel.workspace_id).filter(
                    ScenarioModel.workspace_id.isnot(None)
                )
            )
        ).scalar() or 0

        users_with_funds = self.session.query(
            func.count(distinct(WorkspaceModel.owner_user_id))
        ).filter(
            WorkspaceModel.id.in_(
                self.session.query(FundModel.workspace_id).filter(
                    FundModel.is_system == False  # noqa: E712
                )
            )
        ).scalar() or 0

        users_with_recurring = self.session.query(
            func.count(distinct(WorkspaceModel.owner_user_id))
        ).filter(
            WorkspaceModel.id.in_(
                self.session.query(RecurringTransactionModel.workspace_id)
            )
        ).scalar() or 0

        return {
            "projections": {"count": users_with_scenarios, "rate": round(users_with_scenarios / total * 100, 1)},
            "custom_funds": {"count": users_with_funds, "rate": round(users_with_funds / total * 100, 1)},
            "recurring_transactions": {"count": users_with_recurring, "rate": round(users_with_recurring / total * 100, 1)},
        }

    def get_user_workspace_stats(self, user_id: str) -> dict:
        """Get workspace statistics for a specific user"""
        workspaces = self.session.query(WorkspaceModel).filter(
            WorkspaceModel.owner_user_id == user_id
        ).all()

        stats = []
        for ws in workspaces:
            txn_count = self.session.query(func.count(TransactionModel.id)).filter(
                TransactionModel.workspace_id == ws.id
            ).scalar() or 0
            acc_count = self.session.query(func.count(AccountModel.id)).filter(
                AccountModel.workspace_id == ws.id
            ).scalar() or 0
            stats.append({
                "workspace_id": ws.id,
                "workspace_name": ws.name,
                "base_currency": ws.base_currency,
                "transaction_count": txn_count,
                "account_count": acc_count,
                "created_at": ws.created_at.isoformat() if ws.created_at else None,
            })
        return {"workspaces": stats}
