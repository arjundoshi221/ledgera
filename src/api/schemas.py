"""Pydantic schemas for API"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from decimal import Decimal
from datetime import datetime
from uuid import UUID


class HealthResponse(BaseModel):
    """Health check response"""
    status: str


class AccountCreate(BaseModel):
    """Create account request"""
    name: str
    account_type: str  # asset, liability
    currency: str = "SGD"
    institution: Optional[str] = None
    starting_balance: Decimal = Decimal(0)


class AccountResponse(BaseModel):
    """Account response"""
    id: UUID
    name: str
    account_type: str
    currency: str
    balance: Decimal
    starting_balance: Decimal = Decimal(0)
    institution: Optional[str] = None
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
    memo: Optional[str] = None
    status: str = "unreconciled"
    source: str = "manual"
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    fund_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    postings: List[PostingSchema]


class TransferCreate(BaseModel):
    """Create a transfer transaction between two accounts"""
    timestamp: datetime
    payee: str = "Transfer"
    memo: Optional[str] = None
    from_account_id: str
    to_account_id: str
    amount: Decimal               # Amount leaving from_account (in from_currency)
    from_currency: str = "SGD"
    to_currency: Optional[str] = None    # Defaults to from_currency if None
    fx_rate: Decimal = Decimal(1)        # received = amount * fx_rate
    source_fund_id: Optional[str] = None
    dest_fund_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    fee: Decimal = Decimal(0)            # Optional FX/transfer fee (in from_currency)
    fee_category_id: Optional[str] = None  # Category for the fee expense


class TransactionResponse(BaseModel):
    """Transaction response"""
    id: UUID
    timestamp: datetime
    payee: str
    memo: Optional[str] = None
    status: str
    source: str
    type: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    fund_id: Optional[str] = None
    source_fund_id: Optional[str] = None
    dest_fund_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SubcategoryBudgetSchema(BaseModel):
    """Budget allocation for a subcategory within a category"""
    subcategory_id: str
    monthly_amount: Decimal
    inflation_override: Optional[Decimal] = None


class CategoryBudgetSchema(BaseModel):
    """Budget allocation for a category"""
    category_id: str
    monthly_amount: Decimal
    inflation_override: Optional[Decimal] = None
    subcategory_budgets: List[SubcategoryBudgetSchema] = []


class OneTimeCostSchema(BaseModel):
    """One-time cost or expense"""
    name: str
    amount: Decimal
    month_index: int
    notes: Optional[str] = None
    category_id: Optional[str] = None


class FXMappingSchema(BaseModel):
    """Foreign exchange mapping for multi-currency display"""
    base_currency: str
    display_currencies: List[str] = []
    rates: Dict[str, Decimal] = {}


class ProjectionAssumptions(BaseModel):
    """Projection assumptions"""
    base_currency: str = "SGD"
    start_date: Optional[datetime] = None
    monthly_salary: Decimal = Decimal(0)
    annual_bonus: Decimal = Decimal(0)
    tax_rate: Decimal = Decimal(0.20)

    # Category-based expenses (preferred)
    category_budgets: List[CategoryBudgetSchema] = []
    expense_inflation_rate: Decimal = Decimal(0.03)

    # Legacy flat expenses (deprecated)
    monthly_expenses: Optional[Decimal] = None

    # One-time costs
    one_time_costs: List[OneTimeCostSchema] = []

    # Fund allocations
    allocation_weights: Dict[str, Decimal] = {}
    bucket_returns: Dict[str, Decimal] = {}

    # Cash buffer rules
    minimum_cash_buffer_months: int = 6
    cash_buffer_bucket_name: Optional[str] = "cash"
    enforce_cash_buffer: bool = False

    # Multi-currency display (optional)
    fx_mapping: Optional[FXMappingSchema] = None


class MonthlyProjectionResponse(BaseModel):
    """Monthly projection result"""
    period: str
    gross_income: Decimal
    taxes: Decimal
    net_income: Decimal
    expenses: Decimal
    expense_breakdown: Dict[str, Decimal] = {}
    one_time_costs: Decimal = Decimal(0)
    one_time_costs_detail: List[Dict] = []
    savings: Decimal
    savings_rate: Decimal
    bucket_allocations: Dict[str, Decimal]
    bucket_balances: Dict[str, Decimal]
    net_income_fx: Dict[str, Decimal] = {}
    total_wealth_fx: Dict[str, Decimal] = {}


class ProjectionResponse(BaseModel):
    """Projection response"""
    scenario_id: str
    months: List[MonthlyProjectionResponse]


class ScenarioCreate(BaseModel):
    """Save a projection as a named simulation"""
    name: str
    description: Optional[str] = None
    assumptions: ProjectionAssumptions
    is_active: bool = False


class ScenarioResponse(BaseModel):
    """Saved simulation response"""
    id: str
    name: str
    description: Optional[str] = None
    assumptions: Optional[dict] = None
    monthly_expenses_total: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ScenarioListItem(BaseModel):
    """Lightweight scenario for list views"""
    id: str
    name: str
    description: Optional[str] = None
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
    detail: Optional[str] = None


class CategoryCreate(BaseModel):
    """Create category request"""
    name: str
    emoji: Optional[str] = None
    type: str  # expense, income
    description: Optional[str] = None


class CategoryResponse(BaseModel):
    """Category response"""
    id: str
    name: str
    emoji: Optional[str] = None
    type: str
    description: Optional[str] = None
    is_system: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class SubcategoryCreate(BaseModel):
    """Create subcategory request"""
    category_id: str
    name: str
    description: Optional[str] = None


class SubcategoryResponse(BaseModel):
    """Subcategory response"""
    id: str
    category_id: str
    name: str
    description: Optional[str] = None
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
    emoji: Optional[str] = None
    description: Optional[str] = None
    allocation_percentage: Decimal = Decimal(0)
    account_ids: List[str] = []  # Legacy: defaults to 100% each
    account_allocations: List[FundAccountAllocation] = []  # Preferred: explicit %


class LinkedAccountSummary(BaseModel):
    """Minimal account info for fund response"""
    id: str
    name: str
    institution: Optional[str] = None
    account_currency: str
    allocation_percentage: Decimal = Decimal(100)


class FundResponse(BaseModel):
    """Fund response"""
    id: str
    name: str
    emoji: Optional[str] = None
    description: Optional[str] = None
    allocation_percentage: Decimal
    is_active: bool
    is_system: bool = False
    created_at: datetime
    linked_accounts: List[LinkedAccountSummary] = []

    class Config:
        from_attributes = True


class FundAllocationOverrideCreate(BaseModel):
    """Create fund allocation override request"""
    fund_id: str
    year: int
    month: int
    allocation_percentage: Decimal


class FundAllocationOverrideResponse(BaseModel):
    """Fund allocation override response"""
    id: str
    fund_id: str
    year: int
    month: int
    allocation_percentage: Decimal
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
    charge_details: List[FundChargeDetail] = []
    fund_income: float
    closing_balance: float


class FundLedgerResponse(BaseModel):
    """Fund ledger view: per-fund monthly time series"""
    fund_id: str
    fund_name: str
    emoji: str
    linked_accounts: List[LinkedAccountSummary]
    months: List[FundMonthlyLedgerRow]
    total_contributions: float
    total_fund_income: float
    current_balance: float


class AccountTrackerRow(BaseModel):
    """One account's tracker data"""
    account_id: str
    account_name: str
    institution: Optional[str] = None
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
    source_fund_id: Optional[str] = None
    dest_fund_id: Optional[str] = None


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
    transfer_suggestions: List[TransferSuggestion] = []
    wc_optimization: Optional[WCOptimization] = None


class FundTrackerResponse(BaseModel):
    """Full fund & account tracker response"""
    fund_ledgers: List[FundLedgerResponse]
    account_summaries: List[AccountTrackerRow]
    summary: FundTrackerSummary


# ─── Net Worth / Portfolio schemas ───

class AccountNetWorthRow(BaseModel):
    """One account in the net worth view"""
    account_id: str
    account_name: str
    institution: Optional[str] = None
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
    accounts: List[AccountNetWorthRow]
    currency_breakdown: List[CurrencyBreakdown]
    history: List[NetWorthHistoryPoint]
    fx_rates_used: Dict[str, float] = {}


# ─── Recurring Transactions schemas ───

class RecurringTransactionCreate(BaseModel):
    """Create a recurring transaction template"""
    name: str
    transaction_type: str  # "income", "expense", "transfer"
    payee: Optional[str] = None
    memo: Optional[str] = None
    amount: Decimal
    currency: str = "SGD"
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    fund_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    account_id: Optional[str] = None
    from_account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    from_currency: Optional[str] = None
    to_currency: Optional[str] = None
    fx_rate: Optional[Decimal] = None
    source_fund_id: Optional[str] = None
    dest_fund_id: Optional[str] = None
    transfer_fee: Optional[Decimal] = Decimal(0)
    fee_category_id: Optional[str] = None
    frequency: str  # daily, weekly, bi_weekly, monthly, quarterly, yearly
    start_date: str  # ISO date string "YYYY-MM-DD"
    end_date: Optional[str] = None


class RecurringTransactionUpdate(BaseModel):
    """Update a recurring transaction template"""
    name: Optional[str] = None
    payee: Optional[str] = None
    memo: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    fund_id: Optional[str] = None
    payment_method_id: Optional[str] = None
    account_id: Optional[str] = None
    from_account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    from_currency: Optional[str] = None
    to_currency: Optional[str] = None
    fx_rate: Optional[Decimal] = None
    source_fund_id: Optional[str] = None
    dest_fund_id: Optional[str] = None
    transfer_fee: Optional[Decimal] = None
    fee_category_id: Optional[str] = None
    frequency: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None


class ConfirmRecurringRequest(BaseModel):
    """Confirm a pending recurring instance"""
    occurrence_date: str  # ISO date of the instance being confirmed
    amount_override: Optional[Decimal] = None
    payee_override: Optional[str] = None
    memo_override: Optional[str] = None


class SkipRecurringRequest(BaseModel):
    """Skip a pending recurring instance"""
    occurrence_date: str  # ISO date of the instance being skipped


# ─── Cards & Payment Methods schemas ───

class CardCreate(BaseModel):
    """Create card request"""
    account_id: str
    card_name: str
    card_type: str  # "credit" or "debit"
    card_network: Optional[str] = None
    last_four: Optional[str] = None


class CardResponse(BaseModel):
    """Card response"""
    id: str
    account_id: str
    card_name: str
    card_type: str
    card_network: Optional[str] = None
    last_four: Optional[str] = None
    is_active: bool
    payment_method_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentMethodCreate(BaseModel):
    """Create payment method request"""
    name: str
    method_type: str  # "digital_wallet" or "custom"
    icon: Optional[str] = None
    linked_account_id: Optional[str] = None


class PaymentMethodResponse(BaseModel):
    """Payment method response"""
    id: str
    name: str
    method_type: str
    icon: Optional[str] = None
    card_id: Optional[str] = None
    linked_account_id: Optional[str] = None
    is_system: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
