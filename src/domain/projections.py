"""Projection engine for financial planning"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Dict, List, Optional
from datetime import datetime
from dateutil.relativedelta import relativedelta


@dataclass
class SubcategoryBudget:
    """Budget allocation for a subcategory within a category"""
    subcategory_id: str
    monthly_amount: Decimal
    inflation_override: Optional[Decimal] = None


@dataclass
class CategoryBudget:
    """Budget allocation for a category"""
    category_id: str  # References existing Category in database
    monthly_amount: Decimal
    inflation_override: Optional[Decimal] = None  # Per-category inflation (overrides global)
    subcategory_budgets: List['SubcategoryBudget'] = field(default_factory=list)


@dataclass
class OneTimeCost:
    """One-time expense or cost in a specific month"""
    name: str
    amount: Decimal
    month_index: int  # Month to apply (0-based from start)
    notes: Optional[str] = None
    category_id: Optional[str] = None  # Optional category association


@dataclass
class FXMapping:
    """Foreign exchange mapping for multi-currency display"""
    base_currency: str  # SGD
    display_currencies: List[str] = field(default_factory=list)  # ["USD", "AED", "INR"]
    rates: Dict[str, Decimal] = field(default_factory=dict)  # {"SGDUSD": 0.74, "SGDAED": 2.73, ...}


@dataclass
class ProjectionAssumptions:
    """Projection model inputs"""
    base_currency: str = "SGD"
    start_date: Optional[datetime] = None  # Projection start date (defaults to now)

    # Income
    monthly_salary: Decimal = Decimal(0)
    annual_bonus: Decimal = Decimal(0)
    other_income: Decimal = Decimal(0)

    # Tax
    tax_rate: Decimal = Decimal(0.20)  # 20% flat rate

    # Expenses - Category-based (preferred) or legacy flat amount
    category_budgets: List[CategoryBudget] = field(default_factory=list)
    expense_inflation_rate: Decimal = Decimal(0.03)  # Default 3% annual (can be overridden per category)

    # Legacy: Simple flat monthly expenses (deprecated, use category_budgets instead)
    monthly_expenses: Optional[Decimal] = None

    # One-time costs (vacations, purchases, medical, etc.)
    one_time_costs: List[OneTimeCost] = field(default_factory=list)

    # Allocations and buckets
    allocation_weights: Dict[str, Decimal] = None  # e.g., {"cash": 0.3, "emergency": 0.2, "invest": 0.5}
    bucket_returns: Dict[str, Decimal] = None  # Annual expected returns per bucket

    # Constraints and rules
    minimum_cash_buffer_months: int = 6
    cash_buffer_bucket_name: Optional[str] = "cash"  # Which bucket is the cash reserve (for buffer rule)
    enforce_cash_buffer: bool = False  # Enable cash buffer priority allocation

    # Multi-currency display (optional)
    fx_mapping: Optional[FXMapping] = None


@dataclass
class MonthlyProjection:
    """Single month projection result"""
    period: str  # "2026-01"
    gross_income: Decimal = Decimal(0)
    taxes: Decimal = Decimal(0)
    net_income: Decimal = Decimal(0)
    expenses: Decimal = Decimal(0)
    expense_breakdown: Dict[str, Decimal] = field(default_factory=dict)  # category_id -> amount
    one_time_costs: Decimal = Decimal(0)  # Total one-time costs this month
    one_time_costs_detail: List[Dict] = field(default_factory=list)  # Detailed list of one-time costs
    savings: Decimal = Decimal(0)  # After expenses AND one-time costs
    bucket_allocations: Dict[str, Decimal] = None  # Amount to each bucket
    bucket_balances: Dict[str, Decimal] = None  # End-of-month balance per bucket
    savings_rate: Decimal = Decimal(0)  # savings / net_income

    # Multi-currency equivalents (optional)
    net_income_fx: Dict[str, Decimal] = field(default_factory=dict)  # {"USD": 7400, "AED": 27300}
    total_wealth_fx: Dict[str, Decimal] = field(default_factory=dict)  # Total bucket balances in each currency


@dataclass
class YearlyProjection:
    """Yearly aggregation of monthly projections"""
    year: int
    gross_income: Decimal = Decimal(0)  # Sum of monthly
    taxes: Decimal = Decimal(0)  # Sum of monthly
    net_income: Decimal = Decimal(0)  # Sum of monthly
    expenses: Decimal = Decimal(0)  # Sum of monthly
    one_time_costs: Decimal = Decimal(0)  # Sum of monthly
    savings: Decimal = Decimal(0)  # Sum of monthly
    avg_savings_rate: Decimal = Decimal(0)  # Average across months
    bucket_balances_start: Dict[str, Decimal] = field(default_factory=dict)  # Start of year
    bucket_balances_end: Dict[str, Decimal] = field(default_factory=dict)  # End of year
    bucket_contributions: Dict[str, Decimal] = field(default_factory=dict)  # Sum of allocations
    total_wealth_end: Decimal = Decimal(0)  # Sum of end balances


def aggregate_to_yearly(projections: List[MonthlyProjection]) -> List[YearlyProjection]:
    """
    Aggregate monthly projections into yearly summaries.

    Args:
        projections: List of monthly projections

    Returns:
        List of yearly aggregated projections
    """
    if not projections:
        return []

    # Group by year
    years_data = {}
    for p in projections:
        year = int(p.period[:4])
        if year not in years_data:
            years_data[year] = []
        years_data[year].append(p)

    # Aggregate each year
    yearly_projections = []
    for year in sorted(years_data.keys()):
        months = years_data[year]

        # Sum of flows
        gross_income = sum(m.gross_income for m in months)
        taxes = sum(m.taxes for m in months)
        net_income = sum(m.net_income for m in months)
        expenses = sum(m.expenses for m in months)
        one_time_costs = sum(m.one_time_costs for m in months)
        savings = sum(m.savings for m in months)

        # Average savings rate
        avg_savings_rate = sum(m.savings_rate for m in months) / len(months) if months else Decimal(0)

        # Start/end balances
        first_month = months[0]
        last_month = months[-1]

        bucket_balances_start = {}
        bucket_balances_end = last_month.bucket_balances or {}

        # For start balances, we need to work backwards from first month's allocations
        # Approximation: if it's first year, start is 0; otherwise use first month's balance - allocation
        for bucket_name in bucket_balances_end.keys():
            if first_month.bucket_allocations:
                first_allocation = first_month.bucket_allocations.get(bucket_name, Decimal(0))
                first_balance = first_month.bucket_balances.get(bucket_name, Decimal(0))
                # Start balance is roughly first balance minus first contribution (simple approximation)
                bucket_balances_start[bucket_name] = max(Decimal(0), first_balance - first_allocation)
            else:
                bucket_balances_start[bucket_name] = Decimal(0)

        # Sum of contributions
        bucket_contributions = {}
        for month in months:
            if month.bucket_allocations:
                for bucket_name, allocation in month.bucket_allocations.items():
                    bucket_contributions[bucket_name] = bucket_contributions.get(bucket_name, Decimal(0)) + allocation

        # Total wealth
        total_wealth_end = sum(bucket_balances_end.values())

        yearly_projections.append(YearlyProjection(
            year=year,
            gross_income=gross_income,
            taxes=taxes,
            net_income=net_income,
            expenses=expenses,
            one_time_costs=one_time_costs,
            savings=savings,
            avg_savings_rate=avg_savings_rate,
            bucket_balances_start=bucket_balances_start,
            bucket_balances_end=bucket_balances_end,
            bucket_contributions=bucket_contributions,
            total_wealth_end=total_wealth_end
        ))

    return yearly_projections


class ProjectionEngine:
    """Deterministic projection engine (MVP)"""

    def __init__(self, assumptions: ProjectionAssumptions):
        """Initialize with assumptions and validate"""
        self.assumptions = assumptions
        if assumptions.allocation_weights is None:
            self.assumptions.allocation_weights = {}
        if assumptions.bucket_returns is None:
            self.assumptions.bucket_returns = {}

        # Validate allocation weights sum to 1.0 (with tolerance)
        if self.assumptions.allocation_weights:
            total_weight = sum(self.assumptions.allocation_weights.values())
            tolerance = Decimal("0.001")  # 0.1% tolerance
            if abs(total_weight - Decimal(1)) > tolerance:
                raise ValueError(
                    f"Allocation weights must sum to 1.0, got {total_weight}. "
                    f"Current weights: {self.assumptions.allocation_weights}"
                )

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
        expense_breakdown = {}
        expenses = Decimal(0)

        if self.assumptions.category_budgets:
            # Category-based expenses (preferred method)
            for category_budget in self.assumptions.category_budgets:
                # Use per-category inflation if specified, otherwise global
                cat_inflation_rate = category_budget.inflation_override or self.assumptions.expense_inflation_rate

                if category_budget.subcategory_budgets:
                    # Subcategory-level breakdown
                    category_total = Decimal(0)
                    for sub_budget in category_budget.subcategory_budgets:
                        # Subcategory inflation: sub override > category override > global
                        sub_inflation = sub_budget.inflation_override or cat_inflation_rate
                        inflation_rate_float = float(sub_inflation)
                        inflation_factor = Decimal(str((1 + inflation_rate_float) ** (month_index / 12)))

                        sub_expense = sub_budget.monthly_amount * inflation_factor
                        composite_key = f"{category_budget.category_id}:{sub_budget.subcategory_id}"
                        expense_breakdown[composite_key] = sub_expense
                        category_total += sub_expense

                    expense_breakdown[category_budget.category_id] = category_total
                    expenses += category_total
                else:
                    # Category-level only (existing behavior)
                    inflation_rate_float = float(cat_inflation_rate)
                    inflation_factor = Decimal(str((1 + inflation_rate_float) ** (month_index / 12)))
                    category_expense = category_budget.monthly_amount * inflation_factor
                    expense_breakdown[category_budget.category_id] = category_expense
                    expenses += category_expense
        elif self.assumptions.monthly_expenses is not None:
            # Legacy flat expenses (backward compatibility)
            inflation_rate_float = float(self.assumptions.expense_inflation_rate)
            inflation_factor = Decimal(str((1 + inflation_rate_float) ** (month_index / 12)))
            expenses = self.assumptions.monthly_expenses * inflation_factor
        else:
            # No expenses configured
            expenses = Decimal(0)

        # One-time costs for this month
        one_time_costs_total = Decimal(0)
        one_time_costs_detail = []
        for cost in self.assumptions.one_time_costs:
            if cost.month_index == month_index:
                one_time_costs_total += cost.amount
                one_time_costs_detail.append({
                    "name": cost.name,
                    "amount": cost.amount,
                    "notes": cost.notes,
                    "category_id": cost.category_id
                })

        # Savings (after expenses and one-time costs)
        savings = max(Decimal(0), net_income - expenses - one_time_costs_total)

        # Allocate savings across buckets with optional cash buffer priority
        bucket_allocations = {}

        if self.assumptions.enforce_cash_buffer and self.assumptions.cash_buffer_bucket_name:
            # Check if cash buffer is below target
            cash_bucket = self.assumptions.cash_buffer_bucket_name
            current_cash = previous_balances.get(cash_bucket, Decimal(0))
            target_cash = expenses * Decimal(self.assumptions.minimum_cash_buffer_months)

            if current_cash < target_cash:
                # Priority allocation to cash until target is met
                cash_needed = target_cash - current_cash
                to_cash = min(savings, cash_needed)  # Don't over-allocate

                # Allocate remainder proportionally
                remainder = savings - to_cash
                for bucket_name, weight in self.assumptions.allocation_weights.items():
                    if bucket_name == cash_bucket:
                        bucket_allocations[bucket_name] = to_cash + (remainder * weight)
                    else:
                        bucket_allocations[bucket_name] = remainder * weight
            else:
                # Cash buffer met, use normal allocation
                for bucket_name, weight in self.assumptions.allocation_weights.items():
                    bucket_allocations[bucket_name] = savings * weight
        else:
            # Normal proportional allocation
            for bucket_name, weight in self.assumptions.allocation_weights.items():
                bucket_allocations[bucket_name] = savings * weight

        # Roll-forward buckets
        bucket_balances = {}
        for bucket_name, allocation in bucket_allocations.items():
            previous_balance = previous_balances.get(bucket_name, Decimal(0))
            annual_return = self.assumptions.bucket_returns.get(bucket_name, Decimal(0))
            # Convert to float for exponentiation, then back to Decimal
            annual_return_float = float(annual_return)
            monthly_return_factor = Decimal(str((1 + annual_return_float) ** (1 / 12)))

            new_balance = previous_balance * monthly_return_factor + allocation
            bucket_balances[bucket_name] = new_balance

        # Calculate savings rate (savings as % of net income)
        savings_rate = savings / net_income if net_income > 0 else Decimal(0)

        # Generate period label using proper date arithmetic
        start_date = self.assumptions.start_date or datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_date = start_date + relativedelta(months=month_index)
        period = period_date.strftime("%Y-%m")

        # Multi-currency conversion (optional)
        net_income_fx = {}
        total_wealth_fx = {}
        if self.assumptions.fx_mapping:
            fx = self.assumptions.fx_mapping
            for currency in fx.display_currencies:
                rate_key = f"{fx.base_currency}{currency}"
                rate = fx.rates.get(rate_key, Decimal(1))

                # Convert net income
                net_income_fx[currency] = net_income * rate

                # Convert total wealth (sum of all bucket balances)
                total_wealth = sum(bucket_balances.values()) if bucket_balances else Decimal(0)
                total_wealth_fx[currency] = total_wealth * rate

        return MonthlyProjection(
            period=period,
            gross_income=gross_income,
            taxes=taxes,
            net_income=net_income,
            expenses=expenses,
            expense_breakdown=expense_breakdown,
            one_time_costs=one_time_costs_total,
            one_time_costs_detail=one_time_costs_detail,
            savings=savings,
            bucket_allocations=bucket_allocations,
            bucket_balances=bucket_balances,
            savings_rate=savings_rate,
            net_income_fx=net_income_fx,
            total_wealth_fx=total_wealth_fx
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
