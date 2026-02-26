"""Database connection and session management"""

import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, Session
from typing import Optional

from .models import Base

# Global session factory
_SessionLocal = None


def init_db(database_url: str, echo: bool = False) -> None:
    """Initialize database connection"""
    global _SessionLocal

    # Railway/Heroku may provide postgres:// but SQLAlchemy 2.0 requires postgresql://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    if database_url.startswith("postgresql://"):
        engine = create_engine(
            database_url,
            echo=echo,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    else:
        engine = create_engine(database_url, echo=echo)
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Run lightweight migrations for new columns on existing tables
    _run_migrations(engine)


def _run_migrations(engine) -> None:
    """Add missing columns to existing tables."""
    insp = inspect(engine)
    is_pg = engine.dialect.name == "postgresql"
    BOOL_FALSE = "FALSE" if is_pg else "0"
    BOOL_TRUE = "TRUE" if is_pg else "1"
    TIMESTAMP_TYPE = "TIMESTAMP" if is_pg else "DATETIME"

    # Accounts migrations
    acc_columns = {c["name"] for c in insp.get_columns("accounts")}
    with engine.begin() as conn:
        if "starting_balance" not in acc_columns:
            conn.execute(text(
                "ALTER TABLE accounts ADD COLUMN starting_balance NUMERIC(19,4) NOT NULL DEFAULT 0"
            ))

    # Fund-account links migration
    if insp.has_table("fund_accounts"):
        fa_cols = {c["name"] for c in insp.get_columns("fund_accounts")}
        if "allocation_percentage" not in fa_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE fund_accounts ADD COLUMN allocation_percentage NUMERIC(5,2) NOT NULL DEFAULT 100"
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
                    f"ALTER TABLE scenarios ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT {BOOL_FALSE}"
                ))

    # Transaction transfer support columns
    if insp.has_table("transactions"):
        tx_cols = {c["name"] for c in insp.get_columns("transactions")}
        with engine.begin() as conn:
            if "type" not in tx_cols:
                conn.execute(text(
                    "ALTER TABLE transactions ADD COLUMN type VARCHAR(20)"
                ))
            if "source_fund_id" not in tx_cols:
                conn.execute(text(
                    "ALTER TABLE transactions ADD COLUMN source_fund_id VARCHAR(36) REFERENCES funds(id)"
                ))
            if "dest_fund_id" not in tx_cols:
                conn.execute(text(
                    "ALTER TABLE transactions ADD COLUMN dest_fund_id VARCHAR(36) REFERENCES funds(id)"
                ))

    # Categories: add is_system column
    if insp.has_table("categories"):
        cat_cols = {c["name"] for c in insp.get_columns("categories")}
        if "is_system" not in cat_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    f"ALTER TABLE categories ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT {BOOL_FALSE}"
                ))

    # Funds: add is_system column
    if insp.has_table("funds"):
        fund_cols = {c["name"] for c in insp.get_columns("funds")}
        if "is_system" not in fund_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    f"ALTER TABLE funds ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT {BOOL_FALSE}"
                ))

    # Users: add profile fields
    if insp.has_table("users"):
        user_cols = {c["name"] for c in insp.get_columns("users")}
        with engine.begin() as conn:
            if "date_of_birth" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN date_of_birth VARCHAR(10)"
                ))
            if "nationalities" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN nationalities TEXT DEFAULT '[]'"
                ))
            if "tax_residencies" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN tax_residencies TEXT DEFAULT '[]'"
                ))
            if "countries_of_interest" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN countries_of_interest TEXT DEFAULT '[]'"
                ))
            if "first_name" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN first_name VARCHAR(100)"
                ))
            if "last_name" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN last_name VARCHAR(100)"
                ))
            if "phone_country_code" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN phone_country_code VARCHAR(5)"
                ))
            if "phone_number" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN phone_number VARCHAR(20)"
                ))
            if "address_line1" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN address_line1 VARCHAR(255)"
                ))
            if "address_line2" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN address_line2 VARCHAR(255)"
                ))
            if "address_city" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN address_city VARCHAR(100)"
                ))
            if "address_state" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN address_state VARCHAR(100)"
                ))
            if "address_postal_code" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN address_postal_code VARCHAR(20)"
                ))
            if "address_country" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN address_country VARCHAR(2)"
                ))
            if "tax_id_number" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN tax_id_number VARCHAR(50)"
                ))
            if "is_us_person" not in user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN is_us_person BOOLEAN DEFAULT {BOOL_FALSE}"
                ))
            if "tos_accepted_at" not in user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN tos_accepted_at {TIMESTAMP_TYPE}"
                ))
            if "privacy_accepted_at" not in user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN privacy_accepted_at {TIMESTAMP_TYPE}"
                ))
            if "tos_version" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN tos_version VARCHAR(10)"
                ))
            if "profile_completed" not in user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT {BOOL_FALSE}"
                ))
            if "auth_provider" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'email'"
                ))
            if "is_admin" not in user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT {BOOL_FALSE}"
                ))
            if "is_disabled" not in user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN is_disabled BOOLEAN NOT NULL DEFAULT {BOOL_FALSE}"
                ))
            if "last_login_at" not in user_cols:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN last_login_at {TIMESTAMP_TYPE}"
                ))
            if "login_count" not in user_cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0"
                ))

    # Fund allocation overrides: add override_amount column
    if insp.has_table("fund_allocation_overrides"):
        fao_cols = {c["name"] for c in insp.get_columns("fund_allocation_overrides")}
        if "override_amount" not in fao_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE fund_allocation_overrides ADD COLUMN override_amount NUMERIC(19,4)"
                ))

    # ── One-time data migrations (tracked in _migrations table) ──

    if not insp.has_table("_migrations"):
        with engine.begin() as conn:
            conn.execute(text(
                f"CREATE TABLE _migrations (name VARCHAR(255) PRIMARY KEY, applied_at {TIMESTAMP_TYPE} DEFAULT CURRENT_TIMESTAMP)"
            ))

    # Mark existing "Working Capital" funds as system
    with engine.begin() as conn:
        already = conn.execute(
            text("SELECT 1 FROM _migrations WHERE name = 'mark_wc_fund_system_v1'")
        ).fetchone()
        if not already:
            conn.execute(text(
                f"UPDATE funds SET is_system = {BOOL_TRUE} WHERE name = 'Working Capital'"
            ))
            conn.execute(text(
                "INSERT INTO _migrations (name) VALUES ('mark_wc_fund_system_v1')"
            ))

    # Create "FX Fees" system category for all workspaces that don't have one
    with engine.begin() as conn:
        already = conn.execute(
            text("SELECT 1 FROM _migrations WHERE name = 'seed_fx_fees_category_v1'")
        ).fetchone()
        if not already:
            import uuid as _uuid
            from datetime import datetime as _dt
            now = _dt.utcnow().isoformat()
            # Get all workspace IDs
            rows = conn.execute(text("SELECT id FROM workspaces")).fetchall()
            for row in rows:
                ws_id = row[0]
                # Check if this workspace already has an "FX Fees" category
                existing = conn.execute(
                    text("SELECT 1 FROM categories WHERE workspace_id = :ws AND name = 'FX Fees'"),
                    {"ws": ws_id}
                ).fetchone()
                if not existing:
                    conn.execute(text(
                        f"INSERT INTO categories (id, workspace_id, name, emoji, type, description, is_system, created_at, updated_at) "
                        f"VALUES (:id, :ws, 'FX Fees', :emoji, 'expense', 'Foreign exchange and transfer fees', {BOOL_TRUE}, :now, :now)"
                    ), {"id": str(_uuid.uuid4()), "ws": ws_id, "emoji": "\U0001f4b1", "now": now})
            conn.execute(text(
                "INSERT INTO _migrations (name) VALUES ('seed_fx_fees_category_v1')"
            ))

    # Transactions: add payment_method_id column
    if insp.has_table("transactions"):
        tx_cols = {c["name"] for c in insp.get_columns("transactions")}
        if "payment_method_id" not in tx_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE transactions ADD COLUMN payment_method_id VARCHAR(36) REFERENCES payment_methods(id)"
                ))

    # Workspaces: add min_wc_balance column
    ws_cols = {c["name"] for c in insp.get_columns("workspaces")}
    if "min_wc_balance" not in ws_cols:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE workspaces ADD COLUMN min_wc_balance NUMERIC(19,4) NOT NULL DEFAULT 0"
            ))

    # Seed system payment methods for existing workspaces
    if insp.has_table("payment_methods"):
        with engine.begin() as conn:
            already = conn.execute(
                text("SELECT 1 FROM _migrations WHERE name = 'seed_payment_methods_v1'")
            ).fetchone()
            if not already:
                import uuid as _uuid
                from datetime import datetime as _dt
                now = _dt.utcnow().isoformat()
                rows = conn.execute(text("SELECT id FROM workspaces")).fetchall()
                for row in rows:
                    ws_id = row[0]
                    for name, mtype, icon, is_sys in [
                        ("Cash", "cash", "\U0001f4b5", True),
                        ("Bank Transfer", "bank_transfer", "\U0001f3e6", True),
                        ("GPay", "digital_wallet", "\U0001f4f1", False),
                        ("Apple Pay", "digital_wallet", "\U0001f34e", False),
                        ("PayPal", "digital_wallet", "\U0001f4b3", False),
                    ]:
                        conn.execute(text(
                            f"INSERT INTO payment_methods (id, workspace_id, name, method_type, icon, is_system, is_active, created_at, updated_at) "
                            f"VALUES (:id, :ws, :name, :mtype, :icon, :is_sys, {BOOL_TRUE}, :now, :now)"
                        ), {"id": str(_uuid.uuid4()), "ws": ws_id, "name": name, "mtype": mtype, "icon": icon, "is_sys": is_sys, "now": now})
                conn.execute(text(
                    "INSERT INTO _migrations (name) VALUES ('seed_payment_methods_v1')"
                ))

    # Flip posting signs: frontend was creating postings with reversed signs
    # (income->bank was negative instead of positive). Negate all amounts to fix.
    if insp.has_table("postings"):
        with engine.begin() as conn:
            already = conn.execute(
                text("SELECT 1 FROM _migrations WHERE name = 'flip_posting_signs_v1'")
            ).fetchone()
            if not already:
                conn.execute(text(
                    "UPDATE postings SET amount = -amount, base_amount = -base_amount"
                ))
                conn.execute(text(
                    "INSERT INTO _migrations (name) VALUES ('flip_posting_signs_v1')"
                ))

    # Seed first admin user from LEDGERA_ADMIN_EMAIL environment variable
    with engine.begin() as conn:
        already = conn.execute(
            text("SELECT 1 FROM _migrations WHERE name = 'seed_admin_user_v1'")
        ).fetchone()
        if not already:
            admin_email = os.environ.get("LEDGERA_ADMIN_EMAIL")
            if admin_email:
                conn.execute(text(
                    f"UPDATE users SET is_admin = {BOOL_TRUE} WHERE email = :email"
                ), {"email": admin_email})
            conn.execute(text(
                "INSERT INTO _migrations (name) VALUES ('seed_admin_user_v1')"
            ))

    # Promote arjundoshi221@gmail.com to admin
    with engine.begin() as conn:
        already = conn.execute(
            text("SELECT 1 FROM _migrations WHERE name = 'promote_arjun_admin_v1'")
        ).fetchone()
        if not already:
            conn.execute(text(
                f"UPDATE users SET is_admin = {BOOL_TRUE} WHERE email = 'arjundoshi221@gmail.com'"
            ))
            conn.execute(text(
                "INSERT INTO _migrations (name) VALUES ('promote_arjun_admin_v1')"
            ))

    # Re-promote arjun after signup (v1 ran before user existed)
    with engine.begin() as conn:
        already = conn.execute(
            text("SELECT 1 FROM _migrations WHERE name = 'promote_arjun_admin_v2'")
        ).fetchone()
        if not already:
            conn.execute(text(
                f"UPDATE users SET is_admin = {BOOL_TRUE} WHERE email = 'arjundoshi221@gmail.com'"
            ))
            conn.execute(text(
                "INSERT INTO _migrations (name) VALUES ('promote_arjun_admin_v2')"
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
