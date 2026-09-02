"""Pydantic schemas for API"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response"""
    status: str


class AccountCreate(BaseModel):
    """Create account request"""
    name: str
    account_type: str  # asset, liability
    currency: str = "SGD"
    institution: str | None = None
    starting_balance: Decimal = Decimal(0)


class AccountResponse(BaseModel):
    """Account response"""
    id: UUID
    name: str
    account_type: str
    currency: str
    balance: Decimal
    starting_balance: Decimal = Decimal(0)
    institution: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PostingSchema(BaseModel):
    """Transaction posting"""
    account_id: UUID
    amount: Decimal
    currency: str = "SGD"
    fx_rate: Decimal = Decimal(1)


class TransactionCreate(BaseModel):
    """Create transaction request"""
    timestamp: datetime
    payee: str
    memo: str | None = None
    status: str = "unreconciled"
    source: str = "manual"
    category_id: str | None = None
    subcategory_id: str | None = None
    fund_id: str | None = None
    payment_method_id: str | None = None
    postings: list[PostingSchema]


class TransferCreate(BaseModel):
    """Create a transfer transaction between two accounts"""
    timestamp: datetime
    payee: str = "Transfer"
    memo: str | None = None
    from_account_id: str
    to_account_id: str
    amount: Decimal               # Amount leaving from_account (in from_currency)
    from_currency: str = "SGD"
    to_currency: str | None = None    # Defaults to from_currency if None
    fx_rate: Decimal = Decimal(1)        # received = amount * fx_rate
    source_fund_id: str | None = None
    dest_fund_id: str | None = None
    payment_method_id: str | None = None
    fee: Decimal = Decimal(0)            # Optional FX/transfer fee (in from_currency)
    fee_category_id: str | None = None  # Category for the fee expense


class TransactionResponse(BaseModel):
    """Transaction response"""
    id: UUID
    timestamp: datetime
    payee: str
    memo: str | None = None
    status: str
    source: str
    type: str | None = None
    category_id: str | None = None
    subcategory_id: str | None = None
    fund_id: str | None = None
    source_fund_id: str | None = None
    dest_fund_id: str | None = None
    payment_method_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class SubcategoryBudgetSchema(BaseModel):
    """Budget allocation for a subcategory within a category"""
    subcategory_id: str
    monthly_amount: Decimal
    inflation_override: Decimal | None = None


class CategoryBudgetSchema(BaseModel):
    """Budget allocation for a category"""
    category_id: str
    monthly_amount: Decimal
    inflation_override: Decimal | None = None
    subcategory_budgets: list[SubcategoryBudgetSchema] = []


class OneTimeCostSchema(BaseModel):
    """One-time cost or expense"""
    name: str
    amount: Decimal
    month_index: int
    notes: str | None = None
    category_id: str | None = None


class FXMappingSchema(BaseModel):
    """Foreign exchange mapping for multi-currency display"""
    base_currency: str
    display_currencies: list[str] = []
    rates: dict[str, Decimal] = {}


class ProjectionAssumptions(BaseModel):
    """Projection assumptions"""
    base_currency: str = "SGD"
    start_date: datetime | None = None
    monthly_salary: Decimal = Decimal(0)
    annual_bonus: Decimal = Decimal(0)
    tax_rate: Decimal = Decimal(0.20)

    # Category-based expenses (preferred)
    category_budgets: list[CategoryBudgetSchema] = []
    expense_inflation_rate: Decimal = Decimal(0.03)

    # Legacy flat expenses (deprecated)
    monthly_expenses: Decimal | None = None

    # One-time costs
    one_time_costs: list[OneTimeCostSchema] = []

    # Fund allocations
    allocation_weights: dict[str, Decimal] = {}
    bucket_returns: dict[str, Decimal] = {}

    # Cash buffer rules
    minimum_cash_buffer_months: int = 6
    cash_buffer_bucket_name: str | None = "cash"
    enforce_cash_buffer: bool = False

    # Multi-currency display (optional)
    fx_mapping: FXMappingSchema | None = None


class MonthlyProjectionResponse(BaseModel):
    """Monthly projection result"""
    period: str
    gross_income: Decimal
    taxes: Decimal
    net_income: Decimal
    expenses: Decimal
    expense_breakdown: dict[str, Decimal] = {}
    one_time_costs: Decimal = Decimal(0)
    one_time_costs_detail: list[dict] = []
    savings: Decimal
    savings_rate: Decimal
    bucket_allocations: dict[str, Decimal]
    bucket_balances: dict[str, Decimal]
    net_income_fx: dict[str, Decimal] = {}
    total_wealth_fx: dict[str, Decimal] = {}


class ProjectionResponse(BaseModel):
    """Projection response"""
    scenario_id: str
    months: list[MonthlyProjectionResponse]


class ScenarioCreate(BaseModel):
    """Save a projection as a named simulation"""
    name: str
    description: str | None = None
    assumptions: ProjectionAssumptions
    is_active: bool = False


class ScenarioResponse(BaseModel):
    """Saved simulation response"""
    id: str
    name: str
    description: str | None = None
    assumptions: dict | None = None
    monthly_expenses_total: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ScenarioListItem(BaseModel):
    """Lightweight scenario for list views"""
    id: str
    name: str
    description: str | None = None
    monthly_expenses_total: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PriceResponse(BaseModel):
    """Price/FX rate response"""
    base_ccy: str
    quote_ccy: str
    rate: Decimal
    timestamp: datetime
    source: str


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    detail: str | None = None


class CategoryCreate(BaseModel):
    """Create category request"""
    name: str
    emoji: str | None = None
    type: str  # expense, income
    description: str | None = None


class CategoryResponse(BaseModel):
    """Category response"""
    id: str
    name: str
    emoji: str | None = None
    type: str
    description: str | None = None
    is_system: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class SubcategoryCreate(BaseModel):
    """Create subcategory request"""
    category_id: str
    name: str
    description: str | None = None


class SubcategoryResponse(BaseModel):
    """Subcategory response"""
    id: str
    category_id: str
    name: str
    description: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class FundAccountAllocation(BaseModel):
    """Per-account allocation within a fund"""
    account_id: str
    allocation_percentage: Decimal = Decimal(100)


class FundCreate(BaseModel):
    """Create fund request"""
    name: str
    emoji: str | None = None
    description: str | None = None
    allocation_percentage: Decimal = Decimal(0)
    account_ids: list[str] = []  # Legacy: defaults to 100% each
    account_allocations: list[FundAccountAllocation] = []  # Preferred: explicit %


class LinkedAccountSummary(BaseModel):
    """Minimal account info for fund response"""
    id: str
    name: str
    institution: str | None = None
    account_currency: str
    allocation_percentage: Decimal = Decimal(100)


class FundResponse(BaseModel):
    """Fund response"""
    id: str
    name: str
    emoji: str | None = None
    description: str | None = None
    allocation_percentage: Decimal
    is_active: bool
    is_system: bool = False
    created_at: datetime
    linked_accounts: list[LinkedAccountSummary] = []

    class Config:
        from_attributes = True


class FundAllocationOverrideCreate(BaseModel):
    """Create fund allocation override request"""
    fund_id: str
    year: int
    month: int
    allocation_percentage: Decimal | None = None
    override_amount: Decimal | None = None
    mode: str | None = None  # "MODEL", "OPTIMIZE", or None (manual)


class FundAllocationOverrideResponse(BaseModel):
    """Fund allocation override response"""
    id: str
    fund_id: str
    year: int
    month: int
    allocation_percentage: Decimal
    override_amount: Decimal | None = None
    mode: str | None = None  # "MODEL", "OPTIMIZE", or None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Fund Tracker schemas ───

class FundChargeDetail(BaseModel):
    """One category's charges within a fund month"""
    category_name: str
    category_emoji: str = ""
    amount: float


class FundMonthlyLedgerRow(BaseModel):
    """One month's data for a fund in the ledger view"""
    year: int
    month: int
    opening_balance: float
    contribution: float
    actual_credits: float = 0
    actual_debits: float = 0
    charge_details: list[FundChargeDetail] = []
    fund_income: float
    closing_balance: float
    self_funding_credits: float = 0


class FundLedgerResponse(BaseModel):
    """Fund ledger view: per-fund monthly time series"""
    fund_id: str
    fund_name: str
    emoji: str
    linked_accounts: list[LinkedAccountSummary]
    months: list[FundMonthlyLedgerRow]
    total_contributions: float
    total_fund_income: float
    current_balance: float
    is_self_funding: bool = False
    self_funding_percentage: float = 0
    overlapping_account_names: list[str] = []


class AccountTrackerRow(BaseModel):
    """One account's tracker data"""
    account_id: str
    account_name: str
    institution: str | None = None
    account_currency: str
    starting_balance: float
    expected_contributions: float
    actual_balance: float
    difference: float
    prev_month_balance: float = 0
    current_month_expected: float = 0
    current_month_difference: float = 0
    # Native currency fields (mark-to-market)
    native_balance: float = 0
    current_fx_rate: float = 1.0
    market_value_base: float = 0
    cost_basis_base: float = 0
    unrealized_fx_gain: float = 0


class AccountMonthlyLedgerRow(BaseModel):
    """One month's data for an account in the ledger view"""
    year: int
    month: int
    opening_balance: float
    expected: float
    actual_credits: float
    actual_debits: float
    closing_balance: float


class AccountLedgerResponse(BaseModel):
    """Account ledger view: per-account monthly time series"""
    account_id: str
    account_name: str
    institution: str | None = None
    account_currency: str
    current_fx_rate: float = 1.0
    months: list[AccountMonthlyLedgerRow]
    current_balance: float
    native_balance: float
    market_value_base: float


class TransferSuggestion(BaseModel):
    """A suggested transfer to reconcile expected vs actual"""
    from_account_name: str = ""
    from_account_id: str = ""
    from_currency: str = "SGD"
    to_account_name: str
    to_account_id: str
    to_currency: str = "SGD"
    amount: float
    currency: str  # base currency amount (kept for backward compat)
    source_fund_id: str | None = None
    dest_fund_id: str | None = None
    note: str | None = None


class WCOptimization(BaseModel):
    """Suggestion when WC balance exceeds 10% of allocated fixed cost"""
    wc_balance: float
    threshold: float
    surplus: float


class FundTrackerSummary(BaseModel):
    """Key metrics for the dashboard view"""
    total_expected: float
    total_actual: float
    total_difference: float
    ytd_contributions: float
    ytd_fund_income: float
    ytd_wc_surplus: float = 0
    unallocated_remainder: float = 0
    transfer_suggestions: list[TransferSuggestion] = []
    wc_optimization: WCOptimization | None = None


class FundTrackerResponse(BaseModel):
    """Full fund & account tracker response"""
    fund_ledgers: list[FundLedgerResponse]
    account_summaries: list[AccountTrackerRow]
    account_ledgers: list[AccountLedgerResponse] = []
    summary: FundTrackerSummary


# ─── Net Worth / Portfolio schemas ───

class AccountNetWorthRow(BaseModel):
    """One account in the net worth view"""
    account_id: str
    account_name: str
    institution: str | None = None
    account_currency: str
    account_type: str
    native_balance: float
    fx_rate_to_base: float
    base_value: float
    cost_basis: float
    unrealized_fx_gain: float


class CurrencyBreakdown(BaseModel):
    """Currency allocation in the portfolio"""
    currency: str
    total_native: float
    base_equivalent: float
    percentage: float


class NetWorthHistoryPoint(BaseModel):
    """Net worth at a point in time"""
    year: int
    month: int
    net_worth: float
    assets: float
    liabilities: float


class NetWorthResponse(BaseModel):
    """Full net worth / portfolio response"""
    base_currency: str
    total_net_worth: float
    total_assets: float
    total_liabilities: float
    total_unrealized_fx_gain: float
    accounts: list[AccountNetWorthRow]
    currency_breakdown: list[CurrencyBreakdown]
    history: list[NetWorthHistoryPoint]
    fx_rates_used: dict[str, float] = {}


# ─── Recurring Transactions schemas ───

class RecurringTransactionCreate(BaseModel):
    """Create a recurring transaction template"""
    name: str
    transaction_type: str  # "income", "expense", "transfer"
    payee: str | None = None
    memo: str | None = None
    amount: Decimal
    currency: str = "SGD"
    category_id: str | None = None
    subcategory_id: str | None = None
    fund_id: str | None = None
    payment_method_id: str | None = None
    account_id: str | None = None
    from_account_id: str | None = None
    to_account_id: str | None = None
    from_currency: str | None = None
    to_currency: str | None = None
    fx_rate: Decimal | None = None
    source_fund_id: str | None = None
    dest_fund_id: str | None = None
    transfer_fee: Decimal | None = Decimal(0)
    fee_category_id: str | None = None
    frequency: str  # daily, weekly, bi_weekly, monthly, quarterly, yearly
    start_date: str  # ISO date string "YYYY-MM-DD"
    end_date: str | None = None


class RecurringTransactionUpdate(BaseModel):
    """Update a recurring transaction template"""
    name: str | None = None
    payee: str | None = None
    memo: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    category_id: str | None = None
    subcategory_id: str | None = None
    fund_id: str | None = None
    payment_method_id: str | None = None
    account_id: str | None = None
    from_account_id: str | None = None
    to_account_id: str | None = None
    from_currency: str | None = None
    to_currency: str | None = None
    fx_rate: Decimal | None = None
    source_fund_id: str | None = None
    dest_fund_id: str | None = None
    transfer_fee: Decimal | None = None
    fee_category_id: str | None = None
    frequency: str | None = None
    end_date: str | None = None
    is_active: bool | None = None


class ConfirmRecurringRequest(BaseModel):
    """Confirm a pending recurring instance"""
    occurrence_date: str  # ISO date of the instance being confirmed
    amount_override: Decimal | None = None
    payee_override: str | None = None
    memo_override: str | None = None


class SkipRecurringRequest(BaseModel):
    """Skip a pending recurring instance"""
    occurrence_date: str  # ISO date of the instance being skipped


# ─── Cards & Payment Methods schemas ───

class CardCreate(BaseModel):
    """Create card request"""
    account_id: str
    card_name: str
    card_type: str  # "credit" or "debit"
    card_network: str | None = None
    last_four: str | None = None


class CardResponse(BaseModel):
    """Card response"""
    id: str
    account_id: str
    card_name: str
    card_type: str
    card_network: str | None = None
    last_four: str | None = None
    is_active: bool
    payment_method_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentMethodCreate(BaseModel):
    """Create payment method request"""
    name: str
    method_type: str  # "digital_wallet" or "custom"
    icon: str | None = None
    linked_account_id: str | None = None


class PaymentMethodResponse(BaseModel):
    """Payment method response"""
    id: str
    name: str
    method_type: str
    icon: str | None = None
    card_id: str | None = None
    linked_account_id: str | None = None
    is_system: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Bank Statement Import schemas ───

class FileHeadersResponse(BaseModel):
    """Response from reading file headers for column mapping"""
    headers: list[str]  # Column names from CSV/XLSX
    preview_rows: list[dict[str, str]]  # First 5 rows as dict
    suggested_mapping: dict[str, str]  # Auto-suggested column mapping
    total_rows: int
    file_type: str  # "csv" or "xlsx"
    sheet_name: str | None = None  # For XLSX files


class ParsedTransaction(BaseModel):
    """A single parsed transaction from the import file"""
    row_number: int
    # Original file values
    date_str: str
    payee: str
    memo: str | None = None
    debit_str: str | None = None
    credit_str: str | None = None
    # Parsed values
    timestamp: datetime | None = None  # null if parse failed
    amount: Decimal  # Positive for income/credit, negative for expense/debit
    transaction_type: str  # "income", "expense", or "transfer"
    # Pre-set (from selected account)
    account_id: str
    account_name: str
    currency: str  # from account currency
    # To be filled by user (manually reviewed and categorized)
    category_id: str | None = None
    subcategory_id: str | None = None
    fund_id: str | None = None
    payment_method_id: str | None = None
    transfer_account_id: str | None = None  # For transfers: the other account
    # Validation
    warnings: list[str] = []  # ["Invalid date format", etc.]
    has_errors: bool = False


class FileParseResult(BaseModel):
    """Result from parsing a file with column mapping"""
    total_rows: int
    parsed_transactions: list[ParsedTransaction]
    account_id: str
    account_name: str
