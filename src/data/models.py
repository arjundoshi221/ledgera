"""SQLAlchemy database models"""

from sqlalchemy import (
    Column, String, Numeric, DateTime, ForeignKey,
    Enum, Text, Boolean, Table, Index, Integer
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()


def new_uuid():
    return str(uuid.uuid4())


# === Auth & Tenancy ===

class UserModel(Base):
    """User account"""
    __tablename__ = 'users'

    id = Column(String(36), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(255))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspaces = relationship("WorkspaceModel", back_populates="owner")


class WorkspaceModel(Base):
    """User's workspace (ledger + settings)"""
    __tablename__ = 'workspaces'

    id = Column(String(36), primary_key=True, default=new_uuid)
    owner_user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False, default='Personal')
    base_currency = Column(String(3), nullable=False, default='SGD')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    owner = relationship("UserModel", back_populates="workspaces")
    accounts = relationship("AccountModel", back_populates="workspace", cascade="all, delete-orphan")
    transactions = relationship("TransactionModel", back_populates="workspace", cascade="all, delete-orphan")
    categories = relationship("CategoryModel", back_populates="workspace", cascade="all, delete-orphan")
    funds = relationship("FundModel", back_populates="workspace", cascade="all, delete-orphan")


# === Accounting ===

class AccountModel(Base):
    """ORM model for Account entity"""
    __tablename__ = 'accounts'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # asset, liability, income, expense, equity
    account_currency = Column(String(3), nullable=False, default='SGD')
    institution = Column(String(255))
    starting_balance = Column(Numeric(19, 4), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel", back_populates="accounts")
    postings = relationship("PostingModel", back_populates="account", cascade="all, delete-orphan")

    # Index for common queries
    __table_args__ = (
        Index('idx_accounts_workspace_active', 'workspace_id', 'is_active'),
    )


class CategoryModel(Base):
    """ORM model for expense/income Category entity"""
    __tablename__ = 'categories'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    emoji = Column(String(10))  # e.g., "🏠", "🍽️"
    type = Column(String(50), nullable=False)  # expense, income
    description = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel", back_populates="categories")
    subcategories = relationship("SubcategoryModel", back_populates="category", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_categories_workspace_type', 'workspace_id', 'type'),
    )


class SubcategoryModel(Base):
    """ORM model for Subcategory entity"""
    __tablename__ = 'subcategories'

    id = Column(String(36), primary_key=True, default=new_uuid)
    category_id = Column(String(36), ForeignKey('categories.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    category = relationship("CategoryModel", back_populates="subcategories")

    __table_args__ = (
        Index('idx_subcategories_category', 'category_id'),
    )


class FundModel(Base):
    """ORM model for Fund entity (allocation buckets)"""
    __tablename__ = 'funds'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    emoji = Column(String(10))  # e.g., "🧾", "📈", "✈️"
    description = Column(Text)
    allocation_percentage = Column(Numeric(5, 2), default=0)  # Default allocation %
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel", back_populates="funds")
    accounts = relationship("AccountModel", secondary="fund_accounts", backref="funds")

    __table_args__ = (
        Index('idx_funds_workspace_active', 'workspace_id', 'is_active'),
    )


class FundAllocationOverrideModel(Base):
    """Per-month override for fund allocation percentages"""
    __tablename__ = 'fund_allocation_overrides'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    fund_id = Column(String(36), ForeignKey('funds.id'), nullable=False, index=True)
    year = Column(Integer, nullable=False)  # e.g., 2026
    month = Column(Integer, nullable=False)  # 1-12
    allocation_percentage = Column(Numeric(5, 2), nullable=False)  # Override percentage
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel")
    fund = relationship("FundModel")

    __table_args__ = (
        Index('idx_overrides_workspace_fund_period', 'workspace_id', 'fund_id', 'year', 'month', unique=True),
    )


# Association table for fund-account links (many-to-many)
fund_accounts = Table(
    'fund_accounts',
    Base.metadata,
    Column('fund_id', String(36), ForeignKey('funds.id'), primary_key=True),
    Column('account_id', String(36), ForeignKey('accounts.id'), primary_key=True)
)


# Association table for transaction tags
transaction_tags = Table(
    'transaction_tags',
    Base.metadata,
    Column('transaction_id', String(36), ForeignKey('transactions.id')),
    Column('tag_id', String(36), ForeignKey('tags.id'))
)


class TagModel(Base):
    """ORM model for Tag entity"""
    __tablename__ = 'tags'

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    transactions = relationship(
        "TransactionModel",
        secondary=transaction_tags,
        back_populates="tags"
    )


class TransactionModel(Base):
    """ORM model for Transaction entity"""
    __tablename__ = 'transactions'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False)
    payee = Column(String(255))
    memo = Column(Text)
    status = Column(String(50), nullable=False, default='unreconciled')
    source = Column(String(50))  # manual, csv_import, sync, etc.
    import_hash = Column(String(64))  # SHA-256 of (payee + amount + date) for dedup
    category_id = Column(String(36), ForeignKey('categories.id'), index=True)
    subcategory_id = Column(String(36), ForeignKey('subcategories.id'), index=True)
    fund_id = Column(String(36), ForeignKey('funds.id'), index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel", back_populates="transactions")
    postings = relationship("PostingModel", back_populates="transaction", cascade="all, delete-orphan")
    tags = relationship(
        "TagModel",
        secondary=transaction_tags,
        back_populates="transactions"
    )
    category = relationship("CategoryModel")
    subcategory = relationship("SubcategoryModel")
    fund = relationship("FundModel")

    __table_args__ = (
        Index('idx_transactions_workspace_timestamp', 'workspace_id', 'timestamp'),
        Index('idx_transactions_import_hash', 'workspace_id', 'import_hash'),
        Index('idx_transactions_category', 'category_id'),
        Index('idx_transactions_fund', 'fund_id'),
    )


class PostingModel(Base):
    """ORM model for Posting entity (double-entry line)"""
    __tablename__ = 'postings'

    id = Column(String(36), primary_key=True, default=new_uuid)
    transaction_id = Column(String(36), ForeignKey('transactions.id'), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey('accounts.id'), nullable=False, index=True)
    amount = Column(Numeric(19, 4), nullable=False)  # In posting_currency
    posting_currency = Column(String(3), nullable=False, default='SGD')
    fx_rate_to_base = Column(Numeric(19, 6), nullable=False, default=1.0)
    base_amount = Column(Numeric(19, 4), nullable=False)  # Pre-computed: amount * fx_rate_to_base
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    transaction = relationship("TransactionModel", back_populates="postings")
    account = relationship("AccountModel", back_populates="postings")

    __table_args__ = (
        Index('idx_postings_account', 'account_id'),
    )


class PriceModel(Base):
    """ORM model for Price entity (FX rates or security prices)"""
    __tablename__ = 'prices'

    id = Column(String(36), primary_key=True, default=new_uuid)
    base_ccy = Column(String(3), nullable=False)
    quote_ccy = Column(String(3), nullable=False)
    rate = Column(Numeric(19, 6), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    source = Column(String(50))  # yahoo_finance, manual, etc.
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_prices_pair_timestamp', 'base_ccy', 'quote_ccy', 'timestamp'),
    )


class ScenarioModel(Base):
    """ORM model for Scenario entity"""
    __tablename__ = 'scenarios'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    assumptions_json = Column(Text, nullable=False, default='{}')
    monthly_expenses_total = Column(Numeric(19, 4), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel")
    assumptions = relationship("ProjectionAssumptionModel", back_populates="scenario", cascade="all, delete-orphan")
    results = relationship("ProjectionResultModel", back_populates="scenario", cascade="all, delete-orphan")


class ProjectionAssumptionModel(Base):
    """ORM model for ProjectionAssumption entity"""
    __tablename__ = 'projection_assumptions'

    id = Column(String(36), primary_key=True, default=new_uuid)
    scenario_id = Column(String(36), ForeignKey('scenarios.id'), nullable=False, index=True)
    key = Column(String(255), nullable=False)  # monthly_salary, tax_rate, etc.
    value = Column(Text, nullable=False)  # Stored as string
    currency = Column(String(3))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    scenario = relationship("ScenarioModel", back_populates="assumptions")


class ProjectionResultModel(Base):
    """ORM model for ProjectionResult entity"""
    __tablename__ = 'projection_results'

    id = Column(String(36), primary_key=True, default=new_uuid)
    scenario_id = Column(String(36), ForeignKey('scenarios.id'), nullable=False, index=True)
    period = Column(String(50), nullable=False)  # 2026-01, 2026-Q1, etc.
    metric_key = Column(String(255), nullable=False)  # net_income, savings_rate, etc.
    value = Column(Numeric(19, 4), nullable=False)
    currency = Column(String(3), nullable=False, default='SGD')
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    scenario = relationship("ScenarioModel", back_populates="results")
