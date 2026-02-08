"""Tests for ledger operations"""

import pytest
from decimal import Decimal
from src.domain.ledger import Ledger


def test_ledger_add_account(sample_ledger):
    """Test adding account to ledger"""
    assert len(sample_ledger.accounts) == 3


def test_ledger_add_transaction(sample_ledger, sample_transaction):
    """Test adding transaction to ledger"""
    sample_ledger.add_transaction(sample_transaction)
    assert len(sample_ledger.transactions) == 1


def test_ledger_add_unbalanced_transaction(sample_ledger):
    """Test that unbalanced transaction raises error"""
    from src.domain.models import Posting, Transaction
    
    posting1 = Posting(amount=Decimal(100), base_amount=Decimal(100))
    posting2 = Posting(amount=Decimal(-50), base_amount=Decimal(-50))
    
    tx = Transaction(postings=[posting1, posting2])
    
    with pytest.raises(ValueError):
        sample_ledger.add_transaction(tx)


def test_ledger_get_account_balance(sample_ledger, sample_transaction):
    """Test getting account balance"""
    sample_ledger.add_transaction(sample_transaction)
    
    accounts = list(sample_ledger.accounts.values())
    checking = accounts[0]
    
    balance = sample_ledger.get_account_balance(checking.id)
    assert balance == Decimal(5000)


def test_ledger_get_all_balances(sample_ledger, sample_transaction):
    """Test getting all account balances"""
    sample_ledger.add_transaction(sample_transaction)
    
    balances = sample_ledger.get_balances_by_account()
    assert len(balances) == 3
