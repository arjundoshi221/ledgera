"""Ledger core logic - accounting operations"""

from decimal import Decimal
from typing import List, Dict
from datetime import datetime
from uuid import UUID

from .models import Account, Transaction, Posting, AccountType


class Ledger:
    """Core ledger operations for double-entry accounting"""

    def __init__(self):
        """Initialize ledger"""
        self.accounts: Dict[UUID, Account] = {}
        self.transactions: Dict[UUID, Transaction] = {}

    def add_account(self, account: Account) -> None:
        """Add account to ledger"""
        self.accounts[account.id] = account

    def add_transaction(self, transaction: Transaction) -> None:
        """
        Add transaction to ledger.
        
        Raises:
            ValueError: If transaction is not balanced
        """
        if not transaction.is_balanced():
            raise ValueError(f"Transaction {transaction.id} is not balanced")
        
        self.transactions[transaction.id] = transaction

    def get_account_balance(
        self,
        account_id: UUID,
        as_of: datetime = None
    ) -> Decimal:
        """
        Compute account balance at a point in time.
        
        Args:
            account_id: Account UUID
            as_of: Reference date (default: now)
            
        Returns:
            Balance in account's native currency
        """
        if as_of is None:
            as_of = datetime.utcnow()

        balance = Decimal(0)
        for tx in self.transactions.values():
            if tx.timestamp > as_of:
                continue
            
            for posting in tx.postings:
                if posting.account_id == account_id:
                    # Debit (increase) for assets/expenses, credit (decrease) for liabilities/income
                    account = self.accounts.get(account_id)
                    if account and account.type in [AccountType.ASSET, AccountType.EXPENSE]:
                        balance += posting.amount
                    else:
                        balance -= posting.amount

        return balance

    def get_balances_by_account(self, as_of: datetime = None) -> Dict[UUID, Decimal]:
        """Get all account balances"""
        return {
            account_id: self.get_account_balance(account_id, as_of)
            for account_id in self.accounts
        }

    def get_transactions_by_account(
        self,
        account_id: UUID,
        start: datetime = None,
        end: datetime = None
    ) -> List[Transaction]:
        """
        Get transactions for an account in a date range.
        
        Args:
            account_id: Account UUID
            start: Start date (inclusive)
            end: End date (inclusive)
            
        Returns:
            List of transactions
        """
        txs = []
        for tx in self.transactions.values():
            if not any(p.account_id == account_id for p in tx.postings):
                continue
            
            if start and tx.timestamp < start:
                continue
            if end and tx.timestamp > end:
                continue
            
            txs.append(tx)
        
        return sorted(txs, key=lambda t: t.timestamp)
