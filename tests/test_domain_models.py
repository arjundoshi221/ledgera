"""Tests for domain models"""

import pytest
from decimal import Decimal
from src.domain.models import Account, AccountType, Transaction, Posting, TransactionStatus


def test_account_creation():
    """Test account creation"""
    account = Account(
        name="Checking",
        type=AccountType.ASSET,
        account_currency="SGD"
    )

    assert account.name == "Checking"
    assert account.type == AccountType.ASSET
    assert account.account_currency == "SGD"


def test_transaction_balanced(sample_transaction):
    """Test transaction balance check"""
    assert sample_transaction.is_balanced()


def test_transaction_unbalanced():
    """Test detection of unbalanced transaction"""
    posting1 = Posting(
        amount=Decimal(100),
        base_amount=Decimal(100)
    )

    posting2 = Posting(
        amount=Decimal(-50),
        base_amount=Decimal(-50)
    )

    tx = Transaction(postings=[posting1, posting2])
    assert not tx.is_balanced()
