"""SQLAlchemy database models"""

from sqlalchemy import (
    Column, String, Numeric, DateTime, ForeignKey,
    Enum, Text, Boolean, Table, Index, Integer, LargeBinary
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
    hashed_password = Column(String(255))
    display_name = Column(String(255))  # deprecated, kept for backward compat
    first_name = Column(String(100))
    last_name = Column(String(100))
    date_of_birth = Column(String(10))
    nationalities = Column(Text, default='[]')
    tax_residencies = Column(Text, default='[]')
    countries_of_interest = Column(Text, default='[]')
    phone_country_code = Column(String(5))
    phone_number = Column(String(20))
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    address_city = Column(String(100))
    address_state = Column(String(100))
    address_postal_code = Column(String(20))
    address_country = Column(String(2))
    tax_id_number = Column(String(50))
    is_us_person = Column(Boolean, default=False)
    tos_accepted_at = Column(DateTime)
    privacy_accepted_at = Column(DateTime)
    tos_version = Column(String(10))
    profile_completed = Column(Boolean, nullable=False, default=False)
    auth_provider = Column(String(20), default='email')  # 'email' or 'google'
    is_active = Column(Boolean, nullable=False, default=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_disabled = Column(Boolean, nullable=False, default=False)
    last_login_at = Column(DateTime, nullable=True)
    login_count = Column(Integer, nullable=False, default=0)
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
    min_wc_balance = Column(Numeric(19, 4), nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    owner = relationship("UserModel", back_populates="workspaces")
    accounts = relationship("AccountModel", back_populates="workspace", cascade="all, delete-orphan")
    transactions = relationship("TransactionModel", back_populates="workspace", cascade="all, delete-orphan")
    categories = relationship("CategoryModel", back_populates="workspace", cascade="all, delete-orphan")
    funds = relationship("FundModel", back_populates="workspace", cascade="all, delete-orphan")
    cards = relationship("CardModel", back_populates="workspace", cascade="all, delete-orphan")
    payment_methods = relationship("PaymentMethodModel", back_populates="workspace", cascade="all, delete-orphan")


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
    fund_links = relationship("FundAccountLinkModel", back_populates="account")
    cards = relationship("CardModel", back_populates="account")

    # Index for common queries
    __table_args__ = (
        Index('idx_accounts_workspace_active', 'workspace_id', 'is_active'),
    )


class CardModel(Base):
    """ORM model for Card entity (credit/debit cards)"""
    __tablename__ = 'cards'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey('accounts.id'), nullable=False)
    card_name = Column(String(255), nullable=False)
    card_type = Column(String(20), nullable=False)  # "credit" or "debit"
    card_network = Column(String(50))  # "visa", "mastercard", "amex", etc.
    last_four = Column(String(4))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel", back_populates="cards")
    account = relationship("AccountModel", back_populates="cards")
    payment_method = relationship("PaymentMethodModel", back_populates="card", uselist=False)

    __table_args__ = (
        Index('idx_cards_workspace_active', 'workspace_id', 'is_active'),
        Index('idx_cards_account', 'account_id'),
    )


class PaymentMethodModel(Base):
    """ORM model for Payment Method entity"""
    __tablename__ = 'payment_methods'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    method_type = Column(String(50), nullable=False)  # "cash", "bank_transfer", "card", "digital_wallet", "custom"
    icon = Column(String(10))
    card_id = Column(String(36), ForeignKey('cards.id'), nullable=True)
    linked_account_id = Column(String(36), ForeignKey('accounts.id'), nullable=True)
    is_system = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel", back_populates="payment_methods")
    card = relationship("CardModel", back_populates="payment_method", uselist=False)
    linked_account = relationship("AccountModel")

    __table_args__ = (
        Index('idx_payment_methods_workspace_active', 'workspace_id', 'is_active'),
        Index('idx_payment_methods_workspace_type', 'workspace_id', 'method_type'),
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
    is_system = Column(Boolean, nullable=False, default=False)
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
    is_system = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel", back_populates="funds")
    account_links = relationship("FundAccountLinkModel", back_populates="fund", cascade="all, delete-orphan")

    @property
    def accounts(self):
        """Backward-compat: list of linked AccountModels."""
        return [link.account for link in self.account_links]

    __table_args__ = (
        Index('idx_funds_workspace_active', 'workspace_id', 'is_active'),
    )


class FundAllocationOverrideModel(Base):
    """Per-month override for fund allocation percentages or amounts"""
    __tablename__ = 'fund_allocation_overrides'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    fund_id = Column(String(36), ForeignKey('funds.id'), nullable=False, index=True)
    year = Column(Integer, nullable=False)  # e.g., 2026
    month = Column(Integer, nullable=False)  # 1-12
    allocation_percentage = Column(Numeric(5, 2), nullable=False)  # Override percentage
    override_amount = Column(Numeric(19, 4), nullable=True)  # Absolute amount override (for Working Capital)
    mode = Column(String(20), nullable=True)  # "MODEL", "OPTIMIZE", or NULL (manual override)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel")
    fund = relationship("FundModel")

    __table_args__ = (
        Index('idx_overrides_workspace_fund_period', 'workspace_id', 'fund_id', 'year', 'month', unique=True),
    )


class FundAccountLinkModel(Base):
    """Fund-to-account link with allocation percentage"""
    __tablename__ = 'fund_accounts'

    fund_id = Column(String(36), ForeignKey('funds.id'), primary_key=True)
    account_id = Column(String(36), ForeignKey('accounts.id'), primary_key=True)
    allocation_percentage = Column(Numeric(5, 2), nullable=False, default=100)

    # Relationships
    fund = relationship("FundModel", back_populates="account_links")
    account = relationship("AccountModel", back_populates="fund_links")


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
    type = Column(String(20), nullable=True)  # "transfer" or NULL for income/expense/legacy
    source_fund_id = Column(String(36), ForeignKey('funds.id'), nullable=True)
    dest_fund_id = Column(String(36), ForeignKey('funds.id'), nullable=True)
    payment_method_id = Column(String(36), ForeignKey('payment_methods.id'), nullable=True, index=True)
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
    fund = relationship("FundModel", foreign_keys=[fund_id])
    source_fund = relationship("FundModel", foreign_keys=[source_fund_id])
    dest_fund = relationship("FundModel", foreign_keys=[dest_fund_id])
    payment_method = relationship("PaymentMethodModel")

    __table_args__ = (
        Index('idx_transactions_workspace_timestamp', 'workspace_id', 'timestamp'),
        Index('idx_transactions_import_hash', 'workspace_id', 'import_hash'),
        Index('idx_transactions_category', 'category_id'),
        Index('idx_transactions_fund', 'fund_id'),
        Index('idx_transactions_type', 'workspace_id', 'type'),
        Index('idx_transactions_source_fund', 'source_fund_id'),
        Index('idx_transactions_dest_fund', 'dest_fund_id'),
        Index('idx_transactions_payment_method', 'payment_method_id'),
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


# === Recurring Transactions ===

class RecurringTransactionModel(Base):
    """Template for recurring transactions"""
    __tablename__ = 'recurring_transactions'

    id = Column(String(36), primary_key=True, default=new_uuid)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)

    # Display name (e.g. "Monthly Rent", "Salary")
    name = Column(String(255), nullable=False)

    # "income", "expense", or "transfer"
    transaction_type = Column(String(20), nullable=False)

    # Shared transaction template fields
    payee = Column(String(255))
    memo = Column(Text)
    amount = Column(Numeric(19, 4), nullable=False)
    currency = Column(String(3), nullable=False, default='SGD')
    category_id = Column(String(36), ForeignKey('categories.id'), nullable=True)
    subcategory_id = Column(String(36), ForeignKey('subcategories.id'), nullable=True)
    fund_id = Column(String(36), ForeignKey('funds.id'), nullable=True)
    payment_method_id = Column(String(36), ForeignKey('payment_methods.id'), nullable=True)

    # For income/expense: the real account
    account_id = Column(String(36), ForeignKey('accounts.id'), nullable=True)

    # For transfers
    from_account_id = Column(String(36), ForeignKey('accounts.id'), nullable=True)
    to_account_id = Column(String(36), ForeignKey('accounts.id'), nullable=True)
    from_currency = Column(String(3), nullable=True)
    to_currency = Column(String(3), nullable=True)
    fx_rate = Column(Numeric(19, 6), nullable=True)
    source_fund_id = Column(String(36), ForeignKey('funds.id'), nullable=True)
    dest_fund_id = Column(String(36), ForeignKey('funds.id'), nullable=True)
    transfer_fee = Column(Numeric(19, 4), nullable=True, default=0)
    fee_category_id = Column(String(36), ForeignKey('categories.id'), nullable=True)

    # Recurrence configuration
    frequency = Column(String(20), nullable=False)  # daily, weekly, bi_weekly, monthly, quarterly, yearly
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)  # NULL = forever
    next_occurrence = Column(DateTime, nullable=False)

    # Status
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    workspace = relationship("WorkspaceModel")

    __table_args__ = (
        Index('idx_recurring_workspace_active', 'workspace_id', 'is_active'),
        Index('idx_recurring_next_occurrence', 'workspace_id', 'next_occurrence'),
    )


# === Admin & Audit ===

class AuditLogModel(Base):
    """Audit log for admin actions and significant user events"""
    __tablename__ = 'audit_logs'

    id = Column(String(36), primary_key=True, default=new_uuid)
    actor_user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    action = Column(String(100), nullable=False)  # e.g., "admin.user.disable", "user.login"
    target_type = Column(String(50), nullable=True)  # "user", "workspace", etc.
    target_id = Column(String(36), nullable=True, index=True)
    details = Column(Text, nullable=True)  # JSON-encoded context
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    actor = relationship("UserModel")

    __table_args__ = (
        Index('idx_audit_logs_actor_created', 'actor_user_id', 'created_at'),
        Index('idx_audit_logs_action_created', 'action', 'created_at'),
        Index('idx_audit_logs_target', 'target_type', 'target_id'),
    )


# === Bug Reports ===

class BugReportModel(Base):
    """User-submitted bug report"""
    __tablename__ = 'bug_reports'

    id = Column(String(36), primary_key=True, default=new_uuid)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default='open')  # open, in_progress, resolved
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("UserModel")
    media = relationship("BugReportMediaModel", back_populates="bug_report", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_bug_reports_user_status', 'user_id', 'status'),
        Index('idx_bug_reports_status_created', 'status', 'created_at'),
    )


class BugReportMediaModel(Base):
    """Media attachments for bug reports (stored as BLOB)"""
    __tablename__ = 'bug_report_media'

    id = Column(String(36), primary_key=True, default=new_uuid)
    bug_report_id = Column(String(36), ForeignKey('bug_reports.id'), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    bug_report = relationship("BugReportModel", back_populates="media")
