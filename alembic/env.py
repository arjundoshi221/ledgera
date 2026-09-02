"""Alembic environment.

Resolves the SQLAlchemy URL from the same place the running app does
(`DATABASE_URL` env var, falling back to the Settings default of a local
SQLite file) and points autogenerate at our ORM Base metadata.
"""

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

from src.data.models import Base

# Alembic Config object, provides access to values in the .ini file.
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _resolve_database_url() -> str:
    """Prefer explicit DATABASE_URL env var; fall back to Settings default.

    Importing Settings would require the full app env (jwt_secret etc.) to be
    present, which is too heavy for a migration tool. Reading the env var
    directly with the same default keeps alembic usable in a bare shell.
    """
    url = os.environ.get("DATABASE_URL", "sqlite:///./ledgera.db")
    # Match the normalization init_db does — Railway/Heroku hand out postgres://
    # but SQLAlchemy 2.0 requires postgresql://.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def run_migrations_offline() -> None:
    """Emit SQL scripts against a URL without opening a DBAPI connection."""
    url = _resolve_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=url.startswith("sqlite"),
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    ini_section = config.get_section(config.config_ini_section, {}) or {}
    ini_section["sqlalchemy.url"] = _resolve_database_url()

    connectable = engine_from_config(
        ini_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=connection.dialect.name == "sqlite",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
