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
    account_type: str  # asset, liability, income, expense, equity
    currency: str = "SGD"
    institution: Optional[str] = None


class AccountResponse(BaseModel):
    """Account response"""
    id: UUID
    name: str
    account_type: str
    currency: str
    balance: Decimal
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
    postings: List[PostingSchema]


class TransactionResponse(BaseModel):
    """Transaction response"""
    id: UUID
    timestamp: datetime
    payee: str
    memo: Optional[str] = None
    status: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectionAssumptions(BaseModel):
    """Projection assumptions"""
    base_currency: str = "SGD"
    monthly_salary: Decimal = Decimal(0)
    annual_bonus: Decimal = Decimal(0)
    monthly_expenses: Decimal = Decimal(0)
    tax_rate: Decimal = Decimal(0.20)
    expense_inflation_rate: Decimal = Decimal(0.03)
    allocation_weights: Dict[str, Decimal] = {}
    bucket_returns: Dict[str, Decimal] = {}


class MonthlyProjectionResponse(BaseModel):
    """Monthly projection result"""
    period: str
    gross_income: Decimal
    taxes: Decimal
    net_income: Decimal
    expenses: Decimal
    savings: Decimal
    savings_rate: Decimal
    bucket_allocations: Dict[str, Decimal]
    bucket_balances: Dict[str, Decimal]


class ProjectionResponse(BaseModel):
    """Projection response"""
    scenario_id: UUID
    months: List[MonthlyProjectionResponse]


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
