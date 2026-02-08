"""Test fixtures and utilities"""

import pytest
from src.domain.models import Account, AccountType, Transaction, Posting
from src.domain.ledger import Ledger
from decimal import Decimal
from uuid import uuid4


@pytest.fixture
def sample_ledger() -> Ledger:
    """Create sample ledger with accounts"""
    ledger = Ledger()
    
    # Create accounts
    checking = Account(
        name="Checking",
        account_type=AccountType.ASSET,
        currency="SGD"
    )
    
    salary_income = Account(
        name="Salary Income",
        account_type=AccountType.INCOME,
        currency="SGD"
    )
    
    groceries_expense = Account(
        name="Groceries",
        account_type=AccountType.EXPENSE,
        currency="SGD"
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
        currency="SGD",
        base_amount=Decimal(5000)
    )
    
    posting2 = Posting(
        account_id=salary.id,
        amount=Decimal(-5000),
        currency="SGD",
        base_amount=Decimal(-5000)
    )
    
    return Transaction(
        payee="Employer Inc",
        memo="Monthly salary",
        postings=[posting1, posting2]
    )
