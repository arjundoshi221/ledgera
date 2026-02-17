"""Test fixtures and utilities"""

import pytest
from src.domain.models import Account, AccountType, Transaction, Posting
from src.domain.ledger import Ledger
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from src.data.models import Base
from src.data.database import get_session
from src.api.main import app


@pytest.fixture
def sample_ledger() -> Ledger:
    """Create sample ledger with accounts"""
    ledger = Ledger()

    checking = Account(
        name="Checking",
        type=AccountType.ASSET,
        account_currency="SGD"
    )

    salary_income = Account(
        name="Salary Income",
        type=AccountType.INCOME,
        account_currency="SGD"
    )

    groceries_expense = Account(
        name="Groceries",
        type=AccountType.EXPENSE,
        account_currency="SGD"
    )

    ledger.add_account(checking)
    ledger.add_account(salary_income)
    ledger.add_account(groceries_expense)

    return ledger


@pytest.fixture
def sample_transaction(sample_ledger: Ledger) -> Transaction:
    """Create a sample balanced transaction"""
    accounts = list(sample_ledger.accounts.values())
    checking = accounts[0]
    salary = accounts[1]

    posting1 = Posting(
        account_id=checking.id,
        amount=Decimal(5000),
        posting_currency="SGD",
        base_amount=Decimal(5000)
    )

    posting2 = Posting(
        account_id=salary.id,
        amount=Decimal(-5000),
        posting_currency="SGD",
        base_amount=Decimal(-5000)
    )

    return Transaction(
        payee="Employer Inc",
        memo="Monthly salary",
        postings=[posting1, posting2]
    )


# API Test Fixtures

@pytest.fixture
def test_db():
    """Create an in-memory SQLite database for testing"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_session():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_session] = override_get_session
    yield engine
    app.dependency_overrides.clear()


@pytest.fixture
def client(test_db) -> TestClient:
    """Create FastAPI test client"""
    return TestClient(app)


@pytest.fixture
def test_user_data():
    """Test user data"""
    return {
        "email": "test@example.com",
        "password": "Test123!",
        "display_name": "Test User"
    }
