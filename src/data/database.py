"""Database connection and session management"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Optional

# Global session factory
_SessionLocal = None


def init_db(database_url: str, echo: bool = False) -> None:
    """Initialize database connection"""
    global _SessionLocal
    
    engine = create_engine(database_url, echo=echo)
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    from .models import Base
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    """Get database session"""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _SessionLocal()
