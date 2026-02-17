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
    postings: List[PostingSchema]


class TransactionResponse(BaseModel):
    """Transaction response"""
    id: UUID
    timestamp: datetime
    payee: str
    memo: Optional[str] = None
    status: str
    source: str
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    fund_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryBudgetSchema(BaseModel):
    """Budget allocation for a category"""
    category_id: str
    monthly_amount: Decimal
    inflation_override: Optional[Decimal] = None


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


class FundCreate(BaseModel):
    """Create fund request"""
    name: str
    emoji: Optional[str] = None
    description: Optional[str] = None
    allocation_percentage: Decimal = Decimal(0)


class FundResponse(BaseModel):
    """Fund response"""
    id: str
    name: str
    emoji: Optional[str] = None
    description: Optional[str] = None
    allocation_percentage: Decimal
    is_active: bool
    created_at: datetime

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
