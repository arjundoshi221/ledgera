"""Database connection and session management"""

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, Session
from typing import Optional

from .models import Base

# Global session factory
_SessionLocal = None


def init_db(database_url: str, echo: bool = False) -> None:
    """Initialize database connection"""
    global _SessionLocal

    engine = create_engine(database_url, echo=echo)
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Run lightweight migrations for new columns on existing tables
    _run_migrations(engine)


def _run_migrations(engine) -> None:
    """Add missing columns to existing tables."""
    insp = inspect(engine)

    # Accounts migrations
    acc_columns = {c["name"] for c in insp.get_columns("accounts")}
    with engine.begin() as conn:
        if "starting_balance" not in acc_columns:
            conn.execute(text(
                "ALTER TABLE accounts ADD COLUMN starting_balance NUMERIC(19,4) NOT NULL DEFAULT 0"
            ))

    # Scenarios migrations
    if insp.has_table("scenarios"):
        scn_columns = {c["name"] for c in insp.get_columns("scenarios")}
        with engine.begin() as conn:
            if "workspace_id" not in scn_columns:
                conn.execute(text(
                    "ALTER TABLE scenarios ADD COLUMN workspace_id VARCHAR(36) REFERENCES workspaces(id)"
                ))
            if "assumptions_json" not in scn_columns:
                conn.execute(text(
                    "ALTER TABLE scenarios ADD COLUMN assumptions_json TEXT NOT NULL DEFAULT '{}'"
                ))
            if "monthly_expenses_total" not in scn_columns:
                conn.execute(text(
                    "ALTER TABLE scenarios ADD COLUMN monthly_expenses_total NUMERIC(19,4) NOT NULL DEFAULT 0"
                ))
            if "is_active" not in scn_columns:
                conn.execute(text(
                    "ALTER TABLE scenarios ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 0"
                ))


def get_session():
    """Get database session (FastAPI dependency)"""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
