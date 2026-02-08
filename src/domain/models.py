"""Domain models for Ledgera accounting and planning"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from uuid import UUID, uuid4


class AccountType(str, Enum):
    """Account type enumeration"""
    ASSET = "asset"
    LIABILITY = "liability"
    INCOME = "income"
    EXPENSE = "expense"
    EQUITY = "equity"


class TransactionStatus(str, Enum):
    """Transaction status enumeration"""
    UNRECONCILED = "unreconciled"
    RECONCILED = "reconciled"
    PENDING = "pending"


@dataclass
class Account:
    """Represents a bank or investment account"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    account_type: AccountType = AccountType.ASSET
    currency: str = "SGD"  # ISO 4217 code
    institution: Optional[str] = None
    balance: Decimal = Decimal(0)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Category:
    """Represents a transaction category"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    parent_id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Tag:
    """Represents a transaction tag"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Posting:
    """Individual debit/credit line in a transaction"""
    id: UUID = field(default_factory=uuid4)
    transaction_id: UUID = field(default_factory=uuid4)
    account_id: UUID = field(default_factory=uuid4)
    amount: Decimal = Decimal(0)  # Native currency amount
    currency: str = "SGD"
    base_amount: Decimal = Decimal(0)  # Converted to base currency
    fx_rate: Decimal = Decimal(1)  # FX rate used for conversion
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Transaction:
    """Financial transaction with double-entry postings"""
    id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    payee: str = ""
    memo: str = ""
    status: TransactionStatus = TransactionStatus.UNRECONCILED
    source: str = ""  # e.g., "manual", "csv_import", "sync"
    postings: List[Posting] = field(default_factory=list)
    tags: List[Tag] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def is_balanced(self) -> bool:
        """Check if transaction balances (sum of postings == 0 in base currency)"""
        total = sum(p.base_amount for p in self.postings)
        return abs(total) < Decimal("0.01")


@dataclass
class Price:
    """FX rate or security price"""
    id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    base_ccy: str = "SGD"
    quote_ccy: str = "USD"
    rate: Decimal = Decimal(1)
    source: str = "manual"  # e.g., "yahoo_finance", "manual"
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Scenario:
    """Planning scenario for projections"""
    id: UUID = field(default_factory=uuid4)
    name: str = ""
    description: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ProjectionAssumption:
    """Assumption for a projection scenario"""
    id: UUID = field(default_factory=uuid4)
    scenario_id: UUID = field(default_factory=uuid4)
    key: str = ""  # e.g., "monthly_salary", "tax_rate", "inflation_rate"
    value: str = ""  # Stored as string for flexibility
    currency: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ProjectionResult:
    """Result of a projection calculation"""
    id: UUID = field(default_factory=uuid4)
    scenario_id: UUID = field(default_factory=uuid4)
    period: str = ""  # e.g., "2026-01", "2026-Q1"
    metric_key: str = ""  # e.g., "net_income", "savings_rate", "bucket_balance"
    value: Decimal = Decimal(0)
    currency: str = "SGD"
    created_at: datetime = field(default_factory=datetime.utcnow)
