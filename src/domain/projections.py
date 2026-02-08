"""Projection engine for financial planning"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List
from datetime import datetime, timedelta


@dataclass
class ProjectionAssumptions:
    """Projection model inputs"""
    base_currency: str = "SGD"
    
    # Income
    monthly_salary: Decimal = Decimal(0)
    annual_bonus: Decimal = Decimal(0)
    other_income: Decimal = Decimal(0)
    
    # Tax
    tax_rate: Decimal = Decimal(0.20)  # 20% flat rate
    
    # Expenses
    monthly_expenses: Decimal = Decimal(0)
    expense_inflation_rate: Decimal = Decimal(0.03)  # 3% annual
    
    # Allocations and buckets
    allocation_weights: Dict[str, Decimal] = None  # e.g., {"cash": 0.3, "emergency": 0.2, "invest": 0.5}
    bucket_returns: Dict[str, Decimal] = None  # Annual expected returns per bucket
    
    # Constraints
    minimum_cash_buffer_months: int = 6


@dataclass
class MonthlyProjection:
    """Single month projection result"""
    period: str  # "2026-01"
    gross_income: Decimal = Decimal(0)
    taxes: Decimal = Decimal(0)
    net_income: Decimal = Decimal(0)
    expenses: Decimal = Decimal(0)
    savings: Decimal = Decimal(0)
    bucket_allocations: Dict[str, Decimal] = None  # Amount to each bucket
    bucket_balances: Dict[str, Decimal] = None  # End-of-month balance per bucket
    savings_rate: Decimal = Decimal(0)  # savings / net_income


class ProjectionEngine:
    """Deterministic projection engine (MVP)"""

    def __init__(self, assumptions: ProjectionAssumptions):
        """Initialize with assumptions"""
        self.assumptions = assumptions
        if assumptions.allocation_weights is None:
            self.assumptions.allocation_weights = {}
        if assumptions.bucket_returns is None:
            self.assumptions.bucket_returns = {}

    def project_month(
        self,
        month_index: int,
        previous_balances: Dict[str, Decimal] = None
    ) -> MonthlyProjection:
        """
        Project a single month.
        
        Args:
            month_index: Months from start (0-based)
            previous_balances: Bucket balances from prior month
            
        Returns:
            MonthlyProjection with detailed month breakdown
        """
        if previous_balances is None:
            previous_balances = {k: Decimal(0) for k in self.assumptions.allocation_weights}

        # Income after tax
        gross_income = (
            self.assumptions.monthly_salary +
            (self.assumptions.annual_bonus / 12) +
            self.assumptions.other_income
        )
        taxes = gross_income * self.assumptions.tax_rate
        net_income = gross_income - taxes

        # Expenses with inflation
        inflation_factor = (1 + self.assumptions.expense_inflation_rate) ** (month_index / 12)
        expenses = self.assumptions.monthly_expenses * Decimal(str(inflation_factor))

        # Savings
        savings = max(Decimal(0), net_income - expenses)

        # Allocate savings across buckets
        bucket_allocations = {}
        for bucket_name, weight in self.assumptions.allocation_weights.items():
            bucket_allocations[bucket_name] = savings * weight

        # Roll-forward buckets
        bucket_balances = {}
        for bucket_name, allocation in bucket_allocations.items():
            previous_balance = previous_balances.get(bucket_name, Decimal(0))
            annual_return = self.assumptions.bucket_returns.get(bucket_name, Decimal(0))
            monthly_return_factor = (1 + annual_return) ** (1 / 12)
            
            new_balance = previous_balance * monthly_return_factor + allocation
            bucket_balances[bucket_name] = new_balance

        # Calculate savings rate
        savings_rate = net_income / gross_income if gross_income > 0 else Decimal(0)

        period = (datetime.utcnow() + timedelta(days=30*month_index)).strftime("%Y-%m")

        return MonthlyProjection(
            period=period,
            gross_income=gross_income,
            taxes=taxes,
            net_income=net_income,
            expenses=expenses,
            savings=savings,
            bucket_allocations=bucket_allocations,
            bucket_balances=bucket_balances,
            savings_rate=savings_rate
        )

    def project_period(
        self,
        months: int,
        initial_balances: Dict[str, Decimal] = None
    ) -> List[MonthlyProjection]:
        """
        Project multiple months.
        
        Args:
            months: Number of months to project
            initial_balances: Starting bucket balances
            
        Returns:
            List of MonthlyProjection objects
        """
        projections = []
        current_balances = initial_balances or {k: Decimal(0) for k in self.assumptions.allocation_weights}
        
        for month_idx in range(months):
            projection = self.project_month(month_idx, current_balances)
            projections.append(projection)
            current_balances = projection.bucket_balances
        
        return projections
