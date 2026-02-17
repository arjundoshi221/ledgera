"""Domain models for Ledgera accounting and planning"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from uuid import UUID, uuid4


# === Auth & Tenancy ===

@dataclass
class User:
    """Represents an app user"""
    id: UUID = field(default_factory=uuid4)
    email: str = ""
    display_name: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True
    # hashed_password is stored in service layer, not here


@dataclass
class Workspace:
    """Represents a user's workspace (ledger + settings)"""
    id: UUID = field(default_factory=uuid4)
    owner_user_id: UUID = field(default_factory=uuid4)
    name: str = "Personal"
    base_currency: str = "SGD"  # Reporting currency
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


# === Accounting ===

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
    workspace_id: UUID = field(default_factory=uuid4)
    name: str = ""
    type: AccountType = AccountType.ASSET
    account_currency: str = "SGD"  # Currency of postings (account native)
    institution: Optional[str] = None
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Category:
    """Represents a transaction category"""
    id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
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
    amount: Decimal = Decimal(0)  # In posting_currency (usually account currency)
    posting_currency: str = "SGD"
    fx_rate_to_base: Decimal = Decimal(1)  # Snapshot at booking time
    base_amount: Decimal = Decimal(0)  # amount * fx_rate_to_base (pre-computed)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Transaction:
    """Financial transaction with double-entry postings"""
    id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    payee: str = ""
    memo: str = ""
    status: TransactionStatus = TransactionStatus.UNRECONCILED
    source: str = ""  # e.g., "manual", "csv_import", "sync"
    import_hash: Optional[str] = None  # SHA-256 for deduplication
    postings: List[Posting] = field(default_factory=list)
    tags: List[Tag] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def is_balanced(self) -> bool:
        """Check if transaction balances (sum of base_amounts == 0)"""
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
