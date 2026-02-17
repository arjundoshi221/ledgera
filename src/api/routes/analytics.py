"""Analytics and reporting endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from calendar import monthrange
from pydantic import BaseModel

from src.data.database import get_session
from src.data.models import TransactionModel, CategoryModel, SubcategoryModel, FundModel, PostingModel
from src.api.deps import get_workspace_id
from src.api.schemas import FundAllocationOverrideCreate

router = APIRouter()


# ─── Expense Split schemas ───

class SubcategorySplit(BaseModel):
    """Subcategory spending breakdown"""
    subcategory_id: Optional[str] = None
    subcategory_name: str
    total_amount: float
    transaction_count: int


class CategorySplit(BaseModel):
    """Category spending breakdown"""
    category_id: str
    category_name: str
    emoji: str
    total_amount: float
    transaction_count: int
    subcategories: List[SubcategorySplit] = []


class MonthlyExpenseSplit(BaseModel):
    """Monthly expense breakdown by category"""
    year: int
    month: int
    total_expenses: float
    categories: List[CategorySplit]


# ─── Income Allocation schemas ───

class FundAllocationDetail(BaseModel):
    """Per-fund allocation for a single month"""
    fund_id: str
    fund_name: str
    emoji: str
    allocation_percentage: float
    allocated_amount: float
    is_auto: bool = False


class IncomeAllocationRow(BaseModel):
    """One month's row in the income allocation table"""
    year: int
    month: int
    net_income: float
    allocated_fixed_cost: float
    actual_fixed_cost: float
    fixed_cost_optimization: float
    savings_remainder: float
    fund_allocations: List[FundAllocationDetail]
    is_locked: bool
    working_capital_pct_of_income: float
    savings_pct_of_income: float
    total_fund_allocation_pct: float


class FundMeta(BaseModel):
    """Metadata about a fund for column headers"""
    fund_id: str
    fund_name: str
    emoji: str


class IncomeAllocationResponse(BaseModel):
    """Multi-month income allocation response"""
    rows: List[IncomeAllocationRow]
    funds_meta: List[FundMeta]
    active_scenario_name: Optional[str] = None
    active_scenario_id: Optional[str] = None
    budget_benchmark: float = 0


# Keep old schema for backward compat
class FundAllocation(BaseModel):
    fund_id: str
    fund_name: str
    emoji: str
    allocation_percentage: float
    allocated_amount: float


class MonthlyIncomeSplit(BaseModel):
    year: int
    month: int
    total_income: float
    funds: List[FundAllocation]


# ─── Helpers ───

def _get_month_range(year: int, month: int):
    """Return (start_date, end_date) for a given year/month."""
    start = datetime(year, month, 1)
    _, last_day = monthrange(year, month)
    end = datetime(year, month, last_day, 23, 59, 59)
    return start, end


def _prev_month(year: int, month: int):
    """Return (year, month) for the previous month."""
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _get_income_for_month(session: Session, workspace_id: str, year: int, month: int) -> Decimal:
    """Sum of income-category transaction postings for a given month."""
    start, end = _get_month_range(year, month)
    result = session.query(
        func.sum(PostingModel.base_amount)
    ).join(
        TransactionModel, PostingModel.transaction_id == TransactionModel.id
    ).join(
        CategoryModel, TransactionModel.category_id == CategoryModel.id
    ).filter(
        TransactionModel.workspace_id == workspace_id,
        TransactionModel.category_id.isnot(None),
        TransactionModel.timestamp >= start,
        TransactionModel.timestamp <= end,
        CategoryModel.type == 'income',
        PostingModel.base_amount > 0
    ).scalar()
    return Decimal(str(result)) if result else Decimal(0)


def _get_expenses_for_month(session: Session, workspace_id: str, year: int, month: int) -> Decimal:
    """Sum of expense-category transaction postings for a given month (absolute value)."""
    start, end = _get_month_range(year, month)
    result = session.query(
        func.sum(PostingModel.base_amount)
    ).join(
        TransactionModel, PostingModel.transaction_id == TransactionModel.id
    ).join(
        CategoryModel, TransactionModel.category_id == CategoryModel.id
    ).filter(
        TransactionModel.workspace_id == workspace_id,
        TransactionModel.category_id.isnot(None),
        TransactionModel.timestamp >= start,
        TransactionModel.timestamp <= end,
        CategoryModel.type == 'expense',
        PostingModel.base_amount < 0
    ).scalar()
    return abs(Decimal(str(result))) if result else Decimal(0)


# ─── Endpoints ───

@router.get("/expense-split", response_model=MonthlyExpenseSplit)
def get_expense_split(
    year: int,
    month: int,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get monthly expense breakdown by category"""
    try:
        start_date, end_date = _get_month_range(year, month)

        query = session.query(
            TransactionModel.category_id,
            CategoryModel.name,
            CategoryModel.emoji,
            func.count(TransactionModel.id).label('count'),
            func.sum(PostingModel.base_amount).label('total')
        ).join(
            CategoryModel, TransactionModel.category_id == CategoryModel.id
        ).join(
            PostingModel, TransactionModel.id == PostingModel.transaction_id
        ).filter(
            TransactionModel.workspace_id == workspace_id,
            TransactionModel.category_id.isnot(None),
            TransactionModel.timestamp >= start_date,
            TransactionModel.timestamp <= end_date,
            CategoryModel.type == 'expense',
            PostingModel.base_amount < 0
        ).group_by(
            TransactionModel.category_id,
            CategoryModel.name,
            CategoryModel.emoji
        )

        results = query.all()

        # Subcategory-level breakdown
        sub_query = session.query(
            TransactionModel.category_id,
            TransactionModel.subcategory_id,
            SubcategoryModel.name.label('subcategory_name'),
            func.count(TransactionModel.id).label('count'),
            func.sum(PostingModel.base_amount).label('total')
        ).join(
            CategoryModel, TransactionModel.category_id == CategoryModel.id
        ).join(
            PostingModel, TransactionModel.id == PostingModel.transaction_id
        ).outerjoin(
            SubcategoryModel, TransactionModel.subcategory_id == SubcategoryModel.id
        ).filter(
            TransactionModel.workspace_id == workspace_id,
            TransactionModel.category_id.isnot(None),
            TransactionModel.timestamp >= start_date,
            TransactionModel.timestamp <= end_date,
            CategoryModel.type == 'expense',
            PostingModel.base_amount < 0
        ).group_by(
            TransactionModel.category_id,
            TransactionModel.subcategory_id,
            SubcategoryModel.name
        )

        sub_results = sub_query.all()
        sub_map = {}
        for cat_id, sub_id, sub_name, count, total in sub_results:
            if total:
                amount = abs(Decimal(str(total)))
                if amount > 0:
                    if cat_id not in sub_map:
                        sub_map[cat_id] = []
                    sub_map[cat_id].append(SubcategorySplit(
                        subcategory_id=sub_id,
                        subcategory_name=sub_name or "Uncategorized",
                        total_amount=amount,
                        transaction_count=count or 0
                    ))

        categories = []
        total_expenses = Decimal(0)

        for category_id, name, emoji, count, total in results:
            if total:
                amount = abs(Decimal(str(total)))
                if amount > 0:
                    total_expenses += amount
                    subs = sorted(
                        sub_map.get(category_id, []),
                        key=lambda x: x.total_amount,
                        reverse=True
                    )
                    categories.append(CategorySplit(
                        category_id=category_id,
                        category_name=name or "Uncategorized",
                        emoji=emoji or "",
                        total_amount=amount,
                        transaction_count=count or 0,
                        subcategories=subs
                    ))

        return MonthlyExpenseSplit(
            year=year,
            month=month,
            total_expenses=total_expenses,
            categories=sorted(categories, key=lambda x: x.total_amount, reverse=True)
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/income-allocation", response_model=IncomeAllocationResponse)
def get_income_allocation(
    years: int = Query(default=1, ge=1, le=5),
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """
    Get income allocation table for full calendar year(s).

    For each month, uses the PREVIOUS month's income (one-month lag).
    Allocated fixed cost comes from the active simulation's monthly expenses.
    Fund allocation percentages are applied to savings remainder (income - fixed costs).
    Always shows complete calendar years (Jan-Dec).
    """
    try:
        # Get all active funds for this workspace
        funds = session.query(FundModel).filter(
            FundModel.workspace_id == workspace_id,
            FundModel.is_active == True
        ).order_by(FundModel.created_at).all()

        funds_meta = [
            FundMeta(fund_id=f.id, fund_name=f.name, emoji=f.emoji or "")
            for f in funds
        ]

        # Look up active simulation for budget benchmark
        from src.data.repositories import ScenarioRepository, FundAllocationOverrideRepository
        scenario_repo = ScenarioRepository(session)
        active_scenario = scenario_repo.read_active(workspace_id)
        budget_benchmark = Decimal(str(active_scenario.monthly_expenses_total)) if active_scenario else Decimal(0)

        # Load all overrides for this workspace
        override_repo = FundAllocationOverrideRepository(session)
        all_overrides = override_repo.read_by_workspace(workspace_id)
        override_map = {
            (o.fund_id, o.year, o.month): Decimal(str(o.allocation_percentage))
            for o in all_overrides
        }

        # Build rows for full calendar year(s): Jan-Dec
        now = datetime.utcnow()
        current_year = now.year
        start_year = current_year - years + 1

        rows = []
        for y in range(start_year, current_year + 1):
            end_month = now.month if y == current_year else 12
            for m in range(1, end_month + 1):
                # Previous month's income (one-month lag)
                prev_y, prev_m = _prev_month(y, m)
                net_income = _get_income_for_month(session, workspace_id, prev_y, prev_m)

                # This month's actual expenses (fixed cost)
                actual_fixed_cost = _get_expenses_for_month(session, workspace_id, y, m)

                # Allocated fixed cost from active simulation benchmark
                allocated_fixed_cost = budget_benchmark

                # Fixed cost optimization = allocated - actual (positive = underspent)
                fixed_cost_optimization = allocated_fixed_cost - actual_fixed_cost

                # Savings remainder = income minus fixed costs
                savings_remainder = net_income - allocated_fixed_cost

                # Working capital percentages
                if net_income > 0:
                    working_capital_pct_of_income = float((allocated_fixed_cost / net_income) * 100)
                    savings_pct_of_income = float((savings_remainder / net_income) * 100)
                else:
                    working_capital_pct_of_income = 0.0
                    savings_pct_of_income = 0.0

                # Lock: only the current month is editable
                is_locked = not (y == current_year and m == now.month)

                # Allocate funds from savings remainder (not income)
                fund_allocs = []
                total_allocated = Decimal(0)
                for f in funds:
                    # Working Capital fund is auto-calculated from budget model
                    if f.name == "Working Capital":
                        fund_allocs.append(FundAllocationDetail(
                            fund_id=f.id,
                            fund_name=f.name,
                            emoji=f.emoji or "",
                            allocation_percentage=working_capital_pct_of_income,
                            allocated_amount=float(allocated_fixed_cost),
                            is_auto=True,
                        ))
                        continue

                    override_key = (f.id, y, m)
                    if override_key in override_map:
                        pct = override_map[override_key]
                    else:
                        pct = Decimal(str(f.allocation_percentage))

                    allocated = savings_remainder * pct / 100
                    total_allocated += allocated
                    fund_allocs.append(FundAllocationDetail(
                        fund_id=f.id,
                        fund_name=f.name,
                        emoji=f.emoji or "",
                        allocation_percentage=pct,
                        allocated_amount=allocated,
                    ))

                # Sum only non-auto (non-WC) fund percentages for 100% validation
                total_fund_allocation_pct = float(sum(
                    Decimal(str(fa.allocation_percentage)) for fa in fund_allocs
                    if not fa.is_auto
                ))

                rows.append(IncomeAllocationRow(
                    year=y,
                    month=m,
                    net_income=net_income,
                    allocated_fixed_cost=allocated_fixed_cost,
                    actual_fixed_cost=actual_fixed_cost,
                    fixed_cost_optimization=fixed_cost_optimization,
                    savings_remainder=savings_remainder,
                    fund_allocations=fund_allocs,
                    is_locked=is_locked,
                    working_capital_pct_of_income=working_capital_pct_of_income,
                    savings_pct_of_income=savings_pct_of_income,
                    total_fund_allocation_pct=total_fund_allocation_pct,
                ))

        return IncomeAllocationResponse(
            rows=rows,
            funds_meta=funds_meta,
            active_scenario_name=active_scenario.name if active_scenario else None,
            active_scenario_id=active_scenario.id if active_scenario else None,
            budget_benchmark=float(budget_benchmark),
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Keep old endpoint for backward compat
@router.get("/income-split", response_model=MonthlyIncomeSplit)
def get_income_split(
    year: int,
    month: int,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get monthly income allocation by fund (legacy single-month view)"""
    try:
        start_date, end_date = _get_month_range(year, month)

        income_query = session.query(
            TransactionModel.fund_id,
            func.sum(PostingModel.base_amount).label('total')
        ).join(
            CategoryModel, TransactionModel.category_id == CategoryModel.id
        ).join(
            PostingModel, TransactionModel.id == PostingModel.transaction_id
        ).filter(
            TransactionModel.workspace_id == workspace_id,
            TransactionModel.fund_id.isnot(None),
            TransactionModel.timestamp >= start_date,
            TransactionModel.timestamp <= end_date,
            CategoryModel.type == 'income',
            PostingModel.base_amount > 0
        ).group_by(TransactionModel.fund_id)

        income_by_fund = {fund_id: total for fund_id, total in income_query.all() if total}

        funds_query = session.query(FundModel).filter(
            FundModel.workspace_id == workspace_id,
            FundModel.is_active == True
        ).all()

        funds = []
        total_income = Decimal(0)

        for fund in funds_query:
            allocated_amount = income_by_fund.get(fund.id, 0)
            if allocated_amount:
                amount = Decimal(str(allocated_amount))
                if amount > 0:
                    total_income += amount
                    funds.append(FundAllocation(
                        fund_id=fund.id,
                        fund_name=fund.name,
                        emoji=fund.emoji or "",
                        allocation_percentage=fund.allocation_percentage,
                        allocated_amount=amount
                    ))

        return MonthlyIncomeSplit(
            year=year,
            month=month,
            total_income=total_income,
            funds=sorted(funds, key=lambda x: x.allocated_amount, reverse=True)
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Fund Allocation Override endpoints ───

@router.post("/fund-allocation-overrides")
def create_or_update_override(
    override_data: FundAllocationOverrideCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create or update a fund allocation override for a specific month"""
    from src.data.repositories import FundRepository, FundAllocationOverrideRepository
    from src.data.models import FundAllocationOverrideModel

    # Verify fund exists and belongs to workspace
    fund_repo = FundRepository(session)
    fund = fund_repo.read(override_data.fund_id)

    if not fund or fund.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Fund not found")

    # Validate percentage
    if override_data.allocation_percentage < 0 or override_data.allocation_percentage > 100:
        raise HTTPException(status_code=400, detail="Allocation percentage must be between 0 and 100")

    # Validate month
    if override_data.month < 1 or override_data.month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")

    override_repo = FundAllocationOverrideRepository(session)

    # Check if override already exists
    existing = override_repo.read_by_fund_and_period(
        workspace_id,
        override_data.fund_id,
        override_data.year,
        override_data.month
    )

    if existing:
        # Update existing
        existing.allocation_percentage = override_data.allocation_percentage
        return override_repo.update(existing)
    else:
        # Create new
        override = FundAllocationOverrideModel(
            workspace_id=workspace_id,
            fund_id=override_data.fund_id,
            year=override_data.year,
            month=override_data.month,
            allocation_percentage=override_data.allocation_percentage
        )
        return override_repo.create(override)


@router.get("/fund-allocation-overrides")
def list_overrides(
    year: int = None,
    month: int = None,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all fund allocation overrides, optionally filtered by period"""
    from src.data.repositories import FundAllocationOverrideRepository

    override_repo = FundAllocationOverrideRepository(session)

    if year and month:
        overrides = override_repo.read_by_period(workspace_id, year, month)
    else:
        overrides = override_repo.read_by_workspace(workspace_id)

    return overrides


@router.delete("/fund-allocation-overrides/{fund_id}/{year}/{month}")
def delete_override(
    fund_id: str,
    year: int,
    month: int,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete a fund allocation override (revert to fund default)"""
    from src.data.repositories import FundRepository, FundAllocationOverrideRepository

    # Verify fund belongs to workspace
    fund_repo = FundRepository(session)
    fund = fund_repo.read(fund_id)

    if not fund or fund.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Fund not found")

    override_repo = FundAllocationOverrideRepository(session)
    override_repo.delete_by_fund_and_period(workspace_id, fund_id, year, month)

    return {"message": "Override deleted"}
