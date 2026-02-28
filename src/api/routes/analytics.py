"""Analytics and reporting endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from calendar import monthrange
from pydantic import BaseModel

from src.data.database import get_session
from src.data.models import TransactionModel, CategoryModel, SubcategoryModel, FundModel, FundAccountLinkModel, PostingModel, AccountModel, ScenarioModel, WorkspaceModel
from src.api.deps import get_workspace_id
from src.api.schemas import (
    FundAllocationOverrideCreate,
    FundMonthlyLedgerRow, FundLedgerResponse, AccountTrackerRow,
    AccountMonthlyLedgerRow, AccountLedgerResponse,
    FundTrackerSummary, FundTrackerResponse, LinkedAccountSummary,
    TransferSuggestion, FundChargeDetail, WCOptimization,
    AccountNetWorthRow, CurrencyBreakdown, NetWorthHistoryPoint, NetWorthResponse,
)
import json

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
    override_amount: Optional[float] = None
    model_amount: Optional[float] = None
    is_self_funding: bool = False
    self_funding_percentage: float = 0
    self_funding_amount: float = 0
    overlapping_account_names: List[str] = []


class IncomeAllocationRow(BaseModel):
    """One month's row in the income allocation table"""
    year: int
    month: int
    current_month_income: float
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
    total_self_funding_amount: float = 0
    self_funding_savings_ratio: float = 0
    wc_prev_closing_balance: float = 0


class FundMeta(BaseModel):
    """Metadata about a fund for column headers"""
    fund_id: str
    fund_name: str
    emoji: str
    linked_account_names: List[str] = []
    is_self_funding: bool = False
    self_funding_percentage: float = 0
    overlapping_account_names: List[str] = []


class SelfFundingWarning(BaseModel):
    fund_id: str
    fund_name: str
    message: str


class IncomeAllocationResponse(BaseModel):
    """Multi-month income allocation response"""
    rows: List[IncomeAllocationRow]
    funds_meta: List[FundMeta]
    active_scenario_name: Optional[str] = None
    active_scenario_id: Optional[str] = None
    budget_benchmark: float = 0
    self_funding_warnings: List[SelfFundingWarning] = []


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


def _compute_self_funding_metadata(funds, wc_fund):
    """Detect non-WC funds whose linked accounts overlap with WC's linked accounts.

    Returns dict keyed by fund_id with self-funding metadata.
    """
    if not wc_fund:
        return {}

    wc_account_ids = {link.account_id for link in wc_fund.account_links}
    if not wc_account_ids:
        return {}

    result = {}
    for f in funds:
        if f.id == wc_fund.id:
            continue

        overlapping_ids = []
        overlapping_names = []
        self_funding_pct = Decimal(0)

        for link in f.account_links:
            if link.account_id in wc_account_ids:
                overlapping_ids.append(link.account_id)
                overlapping_names.append(link.account.name)
                alloc_pct = Decimal(str(
                    link.allocation_percentage
                    if link.allocation_percentage is not None
                    else 100
                ))
                self_funding_pct += alloc_pct

        if overlapping_ids:
            result[f.id] = {
                "is_self_funding": True,
                "self_funding_percentage": self_funding_pct,
                "is_fully_self_funding": self_funding_pct == Decimal(100),
                "overlapping_account_ids": overlapping_ids,
                "overlapping_account_names": overlapping_names,
            }

    return result


def _batch_wc_balance(session, workspace_id, wc_fund, wc_fund_id):
    """Compute WC opening balance and per-month credits/debits from WC-fund-scoped postings.

    Returns (opening: Decimal, credits: Dict[(y,m), Decimal], debits: Dict[(y,m), Decimal])
    """
    from sqlalchemy import extract as sa_extract

    wc_account_ids = [link.account_id for link in wc_fund.account_links] if wc_fund else []
    opening = Decimal(0)
    credits: Dict[tuple, Decimal] = {}
    debits: Dict[tuple, Decimal] = {}

    if not (wc_fund and wc_account_ids):
        return opening, credits, debits

    for link in wc_fund.account_links:
        acct_start = Decimal(str(link.account.starting_balance or 0))
        alloc_pct = Decimal(str(link.allocation_percentage if link.allocation_percentage is not None else 100))
        opening += acct_start * alloc_pct / 100

    external_acc = session.query(AccountModel).filter(
        AccountModel.workspace_id == workspace_id,
        AccountModel.name == "External"
    ).first()
    ext_filter = [PostingModel.account_id != external_acc.id] if external_acc else []

    # Credits: non-transfer tagged to WC fund + transfer dest to WC fund
    wc_credits_q = session.query(
        sa_extract('year', TransactionModel.timestamp).label('yr'),
        sa_extract('month', TransactionModel.timestamp).label('mo'),
        func.sum(PostingModel.base_amount),
    ).join(
        TransactionModel, PostingModel.transaction_id == TransactionModel.id
    ).filter(
        TransactionModel.workspace_id == workspace_id,
        PostingModel.account_id.in_(wc_account_ids),
        PostingModel.base_amount > 0,
        *ext_filter,
        or_(
            and_(or_(TransactionModel.type.is_(None), TransactionModel.type != "transfer"), TransactionModel.fund_id == wc_fund_id),
            and_(TransactionModel.type == "transfer", TransactionModel.dest_fund_id == wc_fund_id),
        ),
    ).group_by(
        sa_extract('year', TransactionModel.timestamp),
        sa_extract('month', TransactionModel.timestamp),
    ).all()
    for yr, mo, total in wc_credits_q:
        credits[(int(yr), int(mo))] = Decimal(str(total))

    # Debits: non-transfer tagged to WC fund + transfer source from WC fund
    wc_debits_q = session.query(
        sa_extract('year', TransactionModel.timestamp).label('yr'),
        sa_extract('month', TransactionModel.timestamp).label('mo'),
        func.sum(PostingModel.base_amount),
    ).join(
        TransactionModel, PostingModel.transaction_id == TransactionModel.id
    ).filter(
        TransactionModel.workspace_id == workspace_id,
        PostingModel.account_id.in_(wc_account_ids),
        PostingModel.base_amount < 0,
        *ext_filter,
        or_(
            and_(or_(TransactionModel.type.is_(None), TransactionModel.type != "transfer"), TransactionModel.fund_id == wc_fund_id),
            and_(TransactionModel.type == "transfer", TransactionModel.source_fund_id == wc_fund_id),
        ),
    ).group_by(
        sa_extract('year', TransactionModel.timestamp),
        sa_extract('month', TransactionModel.timestamp),
    ).all()
    for yr, mo, total in wc_debits_q:
        debits[(int(yr), int(mo))] = abs(Decimal(str(total)))

    return opening, credits, debits


def _get_income_for_month(session: Session, workspace_id: str, year: int, month: int, fund_id: str = None) -> Decimal:
    """Sum of income-category transaction postings for a given month.
    If fund_id is provided, only includes income assigned to that fund."""
    start, end = _get_month_range(year, month)
    query = session.query(
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
    )
    if fund_id is not None:
        query = query.filter(TransactionModel.fund_id == fund_id)
    result = query.scalar()
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

        # Look up active simulation for budget benchmark
        from src.data.repositories import ScenarioRepository, FundAllocationOverrideRepository
        scenario_repo = ScenarioRepository(session)
        active_scenario = scenario_repo.read_active(workspace_id)
        budget_benchmark = Decimal(str(active_scenario.monthly_expenses_total)) if active_scenario else Decimal(0)

        # Load all overrides for this workspace, split by type
        override_repo = FundAllocationOverrideRepository(session)
        all_overrides = override_repo.read_by_workspace(workspace_id)
        pct_override_map = {}
        amount_override_map = {}
        for o in all_overrides:
            key = (o.fund_id, o.year, o.month)
            if o.override_amount is not None:
                amount_override_map[key] = Decimal(str(o.override_amount))
            else:
                pct_override_map[key] = Decimal(str(o.allocation_percentage))

        # Find Working Capital fund ID (only WC income is counted)
        wc_fund = next((f for f in funds if f.name == "Working Capital"), None)
        wc_fund_id = wc_fund.id if wc_fund else None

        # Detect self-funding funds (non-WC funds sharing WC accounts)
        self_funding_map = _compute_self_funding_metadata(funds, wc_fund)

        funds_meta = [
            FundMeta(
                fund_id=f.id,
                fund_name=f.name,
                emoji=f.emoji or "",
                linked_account_names=[acc.name for acc in getattr(f, 'accounts', []) or []],
                is_self_funding=f.id in self_funding_map,
                self_funding_percentage=float(self_funding_map[f.id]["self_funding_percentage"]) if f.id in self_funding_map else 0,
                overlapping_account_names=self_funding_map[f.id]["overlapping_account_names"] if f.id in self_funding_map else [],
            )
            for f in funds
        ]

        # Build warnings for self-funding funds
        self_funding_warnings = []
        for sf_fund_id, sf_meta in self_funding_map.items():
            sf_fund = next((f for f in funds if f.id == sf_fund_id), None)
            if sf_fund:
                acct_names = ", ".join(sf_meta["overlapping_account_names"])
                if sf_meta["is_fully_self_funding"]:
                    msg = (
                        f"{sf_fund.emoji or ''} {sf_fund.name} is fully self-funding: "
                        f"its account ({acct_names}) is the same as Working Capital. "
                        f"Allocated amounts stay in WC's account."
                    )
                else:
                    msg = (
                        f"{sf_fund.emoji or ''} {sf_fund.name} is {sf_meta['self_funding_percentage']}% self-funding: "
                        f"{acct_names} overlaps with Working Capital."
                    )
                self_funding_warnings.append(SelfFundingWarning(
                    fund_id=sf_fund_id,
                    fund_name=sf_fund.name,
                    message=msg,
                ))

        # ── Workspace minimum WC balance for sweep ──
        workspace = session.query(WorkspaceModel).filter(WorkspaceModel.id == workspace_id).first()
        min_wc_balance = Decimal(str(workspace.min_wc_balance or 0)) if workspace else Decimal(0)

        # ── WC account balance for sweep ──
        wc_opening_balance, wc_monthly_credits, wc_monthly_debits = _batch_wc_balance(
            session, workspace_id, wc_fund, wc_fund_id
        )

        # Build rows for full calendar year(s): Jan-Dec
        now = datetime.utcnow()
        current_year = now.year
        start_year = current_year - years + 1

        wc_running_balance = wc_opening_balance
        rows = []
        for y in range(start_year, current_year + 1):
            end_month = now.month if y == current_year else 12
            for m in range(1, end_month + 1):
                # Current month's actual WC income only
                current_month_income = _get_income_for_month(session, workspace_id, y, m, fund_id=wc_fund_id)

                # Previous month's WC income (one-month lag) = Allocated Budget
                prev_y, prev_m = _prev_month(y, m)
                net_income = _get_income_for_month(session, workspace_id, prev_y, prev_m, fund_id=wc_fund_id)

                # This month's actual expenses (fixed cost)
                actual_fixed_cost = _get_expenses_for_month(session, workspace_id, y, m)

                # WC fund ledger balance: capture prev month closing (updated at end of loop)
                wc_prev_closing = wc_running_balance

                # Allocated fixed cost from active simulation benchmark
                allocated_fixed_cost = budget_benchmark

                # WC credits/debits for this month (also used for running balance below)
                wc_cr = wc_monthly_credits.get((y, m), Decimal(0))
                wc_db = wc_monthly_debits.get((y, m), Decimal(0))

                # Self-funding ratio K for sweep formula
                K = Decimal(0)
                for f_k in funds:
                    if f_k.name == "Working Capital":
                        continue
                    sf_k = self_funding_map.get(f_k.id)
                    if not sf_k:
                        continue
                    pct_k = pct_override_map.get((f_k.id, y, m), Decimal(str(f_k.allocation_percentage)))
                    K += pct_k * Decimal(str(sf_k["self_funding_percentage"])) / Decimal(10000)

                # Determine Working Capital amount
                wc_key = (wc_fund_id, y, m) if wc_fund_id else None
                if wc_key and wc_key in amount_override_map:
                    # Manual override takes precedence
                    wc_amount = amount_override_map[wc_key]
                else:
                    # Auto-optimize: WC = actual costs + shortfall to reach minimum
                    shortfall = max(Decimal(0), min_wc_balance - wc_prev_closing)
                    wc_amount = actual_fixed_cost + shortfall

                # Savings = income - WC allocation, adjusted for self-funding
                raw_savings = net_income - wc_amount
                savings_remainder = max(Decimal(0), raw_savings / (1 + K))

                # Fixed cost optimization = WC - actual (display-only)
                fixed_cost_optimization = wc_amount - actual_fixed_cost

                # Working capital percentages
                if net_income > 0:
                    working_capital_pct_of_income = float((wc_amount / net_income) * 100)
                    savings_pct_of_income = float((savings_remainder / net_income) * 100)
                else:
                    working_capital_pct_of_income = 0.0
                    savings_pct_of_income = 0.0

                # Lock: only the current month is editable
                is_locked = not (y == current_year and m == now.month)

                # Allocate funds from savings remainder
                fund_allocs = []
                total_allocated = Decimal(0)
                for f in funds:
                    # Working Capital fund: editable with amount override
                    if f.name == "Working Capital":
                        if net_income > 0:
                            wc_pct = float((wc_amount / net_income) * 100)
                        else:
                            wc_pct = 0.0
                        fund_allocs.append(FundAllocationDetail(
                            fund_id=f.id,
                            fund_name=f.name,
                            emoji=f.emoji or "",
                            allocation_percentage=wc_pct,
                            allocated_amount=float(wc_amount),
                            is_auto=False,
                            override_amount=float(wc_amount) if wc_key and wc_key in amount_override_map else None,
                            model_amount=float(allocated_fixed_cost),
                        ))
                        continue

                    # Non-WC funds: percentage of savings remainder
                    override_key = (f.id, y, m)
                    pct = pct_override_map.get(override_key, Decimal(str(f.allocation_percentage)))
                    if savings_remainder < 0:
                        allocated = Decimal(0)
                    else:
                        allocated = savings_remainder * pct / 100
                    total_allocated += allocated

                    # Self-funding detection
                    sf = self_funding_map.get(f.id)
                    sf_pct = Decimal(str(sf["self_funding_percentage"])) / 100 if sf else Decimal(0)
                    sf_amount = float(allocated * sf_pct) if sf else 0

                    fund_allocs.append(FundAllocationDetail(
                        fund_id=f.id,
                        fund_name=f.name,
                        emoji=f.emoji or "",
                        allocation_percentage=pct,
                        allocated_amount=allocated,
                        is_self_funding=sf is not None,
                        self_funding_percentage=float(sf["self_funding_percentage"]) if sf else 0,
                        self_funding_amount=sf_amount,
                        overlapping_account_names=sf["overlapping_account_names"] if sf else [],
                    ))

                # Sum only non-WC fund percentages for 100% validation
                total_fund_allocation_pct = float(sum(
                    Decimal(str(fa.allocation_percentage)) for fa in fund_allocs
                    if fa.fund_name != "Working Capital"
                ))

                # Total self-funding amount across all funds this month
                total_self_funding_amount = float(sum(
                    Decimal(str(fa.self_funding_amount))
                    for fa in fund_allocs
                    if fa.is_self_funding
                ))

                # Self-funding savings ratio K = sum(fund_pct * sf_pct) / 10000
                # Used by optimizer to solve fixed-point: WC = (A + B - I*K) / (1 - K)
                self_funding_savings_ratio = float(sum(
                    Decimal(str(fa.allocation_percentage)) * Decimal(str(fa.self_funding_percentage)) / Decimal(10000)
                    for fa in fund_allocs
                    if fa.is_self_funding
                ))

                # Advance WC running balance: closing = opening + credits - sf_deduction - debits
                wc_running_balance = wc_running_balance + wc_cr - Decimal(str(total_self_funding_amount)) - wc_db

                rows.append(IncomeAllocationRow(
                    year=y,
                    month=m,
                    current_month_income=current_month_income,
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
                    total_self_funding_amount=total_self_funding_amount,
                    self_funding_savings_ratio=self_funding_savings_ratio,
                    wc_prev_closing_balance=float(wc_prev_closing),
                ))

        return IncomeAllocationResponse(
            rows=rows,
            funds_meta=funds_meta,
            active_scenario_name=active_scenario.name if active_scenario else None,
            active_scenario_id=active_scenario.id if active_scenario else None,
            budget_benchmark=float(budget_benchmark),
            self_funding_warnings=self_funding_warnings,
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

    # Must provide either allocation_percentage or override_amount
    if override_data.allocation_percentage is None and override_data.override_amount is None:
        raise HTTPException(status_code=400, detail="Must provide allocation_percentage or override_amount")

    # Validate percentage if provided
    if override_data.allocation_percentage is not None:
        if override_data.allocation_percentage < 0 or override_data.allocation_percentage > 100:
            raise HTTPException(status_code=400, detail="Allocation percentage must be between 0 and 100")

    # Validate amount if provided
    if override_data.override_amount is not None:
        if override_data.override_amount < 0:
            raise HTTPException(status_code=400, detail="Override amount must be >= 0")

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
        existing.allocation_percentage = override_data.allocation_percentage or 0
        existing.override_amount = override_data.override_amount
        return override_repo.update(existing)
    else:
        # Create new
        override = FundAllocationOverrideModel(
            workspace_id=workspace_id,
            fund_id=override_data.fund_id,
            year=override_data.year,
            month=override_data.month,
            allocation_percentage=override_data.allocation_percentage or 0,
            override_amount=override_data.override_amount,
        )
        return override_repo.create(override)


@router.get("/fund-allocation-overrides")
def list_overrides(
    year: Optional[int] = None,
    month: Optional[int] = None,
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


# ─── Fund Tracker helpers ───

def _get_fund_income_for_month(session: Session, workspace_id: str, fund_id: str, year: int, month: int) -> Decimal:
    """Sum of income-category transaction postings tagged to a specific fund for a given month."""
    start, end = _get_month_range(year, month)
    result = session.query(
        func.sum(PostingModel.base_amount)
    ).join(
        TransactionModel, PostingModel.transaction_id == TransactionModel.id
    ).join(
        CategoryModel, TransactionModel.category_id == CategoryModel.id
    ).filter(
        TransactionModel.workspace_id == workspace_id,
        TransactionModel.fund_id == fund_id,
        TransactionModel.category_id.isnot(None),
        TransactionModel.timestamp >= start,
        TransactionModel.timestamp <= end,
        CategoryModel.type == 'income',
        PostingModel.base_amount > 0
    ).scalar()
    return Decimal(str(result)) if result else Decimal(0)


def _compute_fund_contribution(
    fund: FundModel,
    savings_remainder: Decimal,
    allocated_fixed_cost: Decimal,
    override_map: dict,
    year: int,
    month: int,
    amount_override_map: dict | None = None,
    default_wc_amount: Decimal | None = None,
) -> Decimal:
    """Compute a single fund's contribution for one month (shared logic)."""
    if fund.name == "Working Capital":
        if amount_override_map and (fund.id, year, month) in amount_override_map:
            return amount_override_map[(fund.id, year, month)]
        if default_wc_amount is not None:
            return default_wc_amount
        return allocated_fixed_cost

    # If savings remainder is negative, only Working Capital absorbs the deficit
    if savings_remainder < 0:
        return Decimal(0)

    override_key = (fund.id, year, month)
    if override_key in override_map:
        pct = override_map[override_key]
    else:
        pct = Decimal(str(fund.allocation_percentage))

    return savings_remainder * pct / 100


# ─── Fund Tracker endpoint ───

@router.get("/fund-tracker", response_model=FundTrackerResponse)
def get_fund_tracker(
    years: int = Query(default=1, ge=1, le=5),
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """
    Get fund & account tracker data with monthly ledger per fund
    and account-level expected vs actual balances.
    """
    try:
        from src.data.repositories import ScenarioRepository, FundAllocationOverrideRepository
        from sqlalchemy.orm import joinedload

        # Load all active funds with account links
        funds = session.query(FundModel).options(
            joinedload(FundModel.account_links).joinedload(FundAccountLinkModel.account)
        ).filter(
            FundModel.workspace_id == workspace_id,
            FundModel.is_active == True
        ).order_by(FundModel.created_at).all()

        # Load all accounts for the workspace (exclude External bookkeeping account)
        all_accounts = session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id,
            AccountModel.is_active == True,
            AccountModel.name != "External"
        ).all()

        # Get External account id for filtering postings
        external_acc = session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id,
            AccountModel.name == "External"
        ).first()
        external_account_id = external_acc.id if external_acc else None

        # Budget benchmark from active scenario
        scenario_repo = ScenarioRepository(session)
        active_scenario = scenario_repo.read_active(workspace_id)
        budget_benchmark = Decimal(str(active_scenario.monthly_expenses_total)) if active_scenario else Decimal(0)

        # Load overrides (percentage for non-WC funds, amount for WC)
        override_repo = FundAllocationOverrideRepository(session)
        all_overrides = override_repo.read_by_workspace(workspace_id)
        override_map = {}
        amount_override_map = {}
        for o in all_overrides:
            key = (o.fund_id, o.year, o.month)
            if o.override_amount is not None:
                amount_override_map[key] = Decimal(str(o.override_amount))
            else:
                override_map[key] = Decimal(str(o.allocation_percentage))

        # Find Working Capital fund ID for savings remainder calculation
        wc_fund = next((f for f in funds if f.name == "Working Capital"), None)
        wc_fund_id = wc_fund.id if wc_fund else None

        # Detect self-funding funds
        sf_map = _compute_self_funding_metadata(funds, wc_fund)

        # Time range
        now = datetime.utcnow()
        current_year = now.year
        start_year = current_year - years + 1

        # Build month list
        months_list = []
        for y in range(start_year, current_year + 1):
            end_month = now.month if y == current_year else 12
            for m in range(1, end_month + 1):
                months_list.append((y, m))

        # ── Batch account credit/debit sums (shared by fund & account ledgers) ──
        from sqlalchemy import extract
        acct_ext_filter = [PostingModel.account_id != external_account_id] if external_account_id else []
        monthly_credits_q = session.query(
            PostingModel.account_id,
            extract('year', TransactionModel.timestamp).label('yr'),
            extract('month', TransactionModel.timestamp).label('mo'),
            func.sum(PostingModel.base_amount),
        ).join(
            TransactionModel, PostingModel.transaction_id == TransactionModel.id
        ).filter(
            TransactionModel.workspace_id == workspace_id,
            PostingModel.base_amount > 0,
            *acct_ext_filter,
        ).group_by(
            PostingModel.account_id,
            extract('year', TransactionModel.timestamp),
            extract('month', TransactionModel.timestamp),
        ).all()

        monthly_debits_q = session.query(
            PostingModel.account_id,
            extract('year', TransactionModel.timestamp).label('yr'),
            extract('month', TransactionModel.timestamp).label('mo'),
            func.sum(PostingModel.base_amount),
        ).join(
            TransactionModel, PostingModel.transaction_id == TransactionModel.id
        ).filter(
            TransactionModel.workspace_id == workspace_id,
            PostingModel.base_amount < 0,
            *acct_ext_filter,
        ).group_by(
            PostingModel.account_id,
            extract('year', TransactionModel.timestamp),
            extract('month', TransactionModel.timestamp),
        ).all()

        # Build lookup dicts: (account_id, year, month) -> Decimal
        acct_monthly_credits = {}
        for acc_id, yr, mo, total in monthly_credits_q:
            acct_monthly_credits[(acc_id, int(yr), int(mo))] = Decimal(str(total))

        acct_monthly_debits = {}
        for acc_id, yr, mo, total in monthly_debits_q:
            acct_monthly_debits[(acc_id, int(yr), int(mo))] = abs(Decimal(str(total)))

        # ── WC balance and sweep savings for fund contributions ──
        wc_opening, wc_m_credits, wc_m_debits = _batch_wc_balance(
            session, workspace_id, wc_fund, wc_fund_id
        )
        workspace = session.query(WorkspaceModel).filter(WorkspaceModel.id == workspace_id).first()
        min_wc_balance = Decimal(str(workspace.min_wc_balance or 0)) if workspace else Decimal(0)

        # Pre-compute sweep savings_remainder and wc_amount per month
        monthly_sweep_savings: Dict[tuple, Decimal] = {}
        monthly_sweep_wc_amount: Dict[tuple, Decimal] = {}
        wc_sweep_running = wc_opening
        for y, m in months_list:
            # K for this month
            K = Decimal(0)
            for f_k in funds:
                if f_k.name == "Working Capital":
                    continue
                sf_k = sf_map.get(f_k.id)
                if not sf_k:
                    continue
                pct_k = override_map.get((f_k.id, y, m), Decimal(str(f_k.allocation_percentage)))
                K += pct_k * Decimal(str(sf_k["self_funding_percentage"])) / Decimal(10000)

            prev_y, prev_m = _prev_month(y, m)
            net_inc = _get_income_for_month(session, workspace_id, prev_y, prev_m)
            actual_costs = _get_expenses_for_month(session, workspace_id, y, m)
            wc_key = (wc_fund_id, y, m) if wc_fund_id else None

            if wc_key and wc_key in amount_override_map:
                wc_amt = amount_override_map[wc_key]
            else:
                shortfall = max(Decimal(0), min_wc_balance - wc_sweep_running)
                wc_amt = actual_costs + shortfall

            raw_savings = net_inc - wc_amt
            sav_rem = max(Decimal(0), raw_savings / (1 + K))

            monthly_sweep_savings[(y, m)] = sav_rem
            monthly_sweep_wc_amount[(y, m)] = wc_amt

            # Advance running balance
            wc_cr = wc_m_credits.get((y, m), Decimal(0))
            wc_db = wc_m_debits.get((y, m), Decimal(0))

            # Advance running balance (self-funding deduction = sav_rem * K)
            sf_deduction = sav_rem * K
            wc_sweep_running = wc_sweep_running + wc_cr - wc_db - sf_deduction

        # ── Per-fund ledger ──
        fund_ledgers = []
        # Track cumulative contributions per fund for account summaries
        fund_total_contributions = {}  # fund_id -> Decimal
        fund_current_month_contribution = {}  # fund_id -> Decimal (current month only)
        fund_month_contributions = {}  # (fund_id, year, month) -> Decimal

        for f in funds:
            fund_months = []
            running_balance = Decimal(0)
            total_contributions = Decimal(0)
            total_fund_income = Decimal(0)

            # Opening balance = sum of linked account starting_balances * allocation %
            for link in f.account_links:
                acct_start = Decimal(str(link.account.starting_balance or 0))
                alloc_pct = Decimal(str(link.allocation_percentage if link.allocation_percentage is not None else 100))
                running_balance += acct_start * alloc_pct / 100

            for y, m in months_list:
                opening = running_balance

                # Expected contribution from income allocation (sweep-based)
                savings_remainder = monthly_sweep_savings.get((y, m), Decimal(0))
                sweep_wc_amount = monthly_sweep_wc_amount.get((y, m), budget_benchmark)

                contribution = _compute_fund_contribution(
                    f, savings_remainder, budget_benchmark, override_map, y, m,
                    amount_override_map=amount_override_map,
                    default_wc_amount=sweep_wc_amount,
                )

                # Store per-fund per-month contribution for account ledgers
                fund_month_contributions[(f.id, y, m)] = contribution

                # Capture current month's contribution for account-level analysis
                if y == now.year and m == now.month:
                    fund_current_month_contribution[f.id] = contribution

                # Actual credits & debits: per-fund transaction-level queries
                start, end = _get_month_range(y, m)
                common_filters = [
                    TransactionModel.workspace_id == workspace_id,
                    TransactionModel.timestamp >= start,
                    TransactionModel.timestamp <= end,
                ]
                ext_filter = [PostingModel.account_id != external_account_id] if external_account_id else []

                # Non-transfer transactions tagged to this fund
                non_transfer_filter = and_(
                    *common_filters,
                    or_(TransactionModel.type.is_(None), TransactionModel.type != "transfer"),
                    TransactionModel.fund_id == f.id,
                )
                # Transfer destination credits (money in)
                transfer_dest_filter = and_(
                    *common_filters,
                    TransactionModel.type == "transfer",
                    TransactionModel.dest_fund_id == f.id,
                    PostingModel.base_amount > 0,
                )
                # Transfer source debits (money out)
                transfer_source_filter = and_(
                    *common_filters,
                    TransactionModel.type == "transfer",
                    TransactionModel.source_fund_id == f.id,
                    PostingModel.base_amount < 0,
                )

                # Credits = positive non-transfer postings + transfer dest
                credits_non_tf = session.query(
                    func.sum(PostingModel.base_amount)
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id
                ).filter(non_transfer_filter, *ext_filter, PostingModel.base_amount > 0).scalar() or 0

                credits_tf = session.query(
                    func.sum(PostingModel.base_amount)
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id
                ).filter(transfer_dest_filter, *ext_filter).scalar() or 0

                actual_credits = Decimal(str(credits_non_tf)) + Decimal(str(credits_tf))
                transfer_credits = Decimal(str(credits_tf))

                # Debits = negative non-transfer postings + transfer source
                debits_non_tf = session.query(
                    func.sum(PostingModel.base_amount)
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id
                ).filter(non_transfer_filter, *ext_filter, PostingModel.base_amount < 0).scalar() or 0

                debits_tf = session.query(
                    func.sum(PostingModel.base_amount)
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id
                ).filter(transfer_source_filter, *ext_filter).scalar() or 0

                actual_debits = abs(Decimal(str(debits_non_tf)) + Decimal(str(debits_tf)))

                # Category breakdown of debits (charges)
                charge_base_filters = [
                    TransactionModel.workspace_id == workspace_id,
                    TransactionModel.fund_id == f.id,
                    or_(TransactionModel.type.is_(None), TransactionModel.type != "transfer"),
                    TransactionModel.timestamp >= start,
                    TransactionModel.timestamp <= end,
                ]
                charge_q = session.query(
                    CategoryModel.name,
                    CategoryModel.emoji,
                    func.sum(PostingModel.base_amount).label("total"),
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id
                ).outerjoin(
                    CategoryModel, TransactionModel.category_id == CategoryModel.id
                ).filter(*charge_base_filters, *ext_filter, PostingModel.base_amount < 0
                ).group_by(CategoryModel.name, CategoryModel.emoji)

                charge_details = [
                    FundChargeDetail(
                        category_name=name or "Uncategorized",
                        category_emoji=emoji or "",
                        amount=abs(float(total)),
                    )
                    for name, emoji, total in charge_q.all() if total
                ]
                if debits_tf and abs(Decimal(str(debits_tf))) > Decimal("0.01"):
                    charge_details.append(FundChargeDetail(
                        category_name="Transfer Out",
                        category_emoji="",
                        amount=abs(float(debits_tf)),
                    ))

                # Fund income (non-WC only — WC income is the budget itself)
                if f.name == "Working Capital":
                    fund_income = Decimal(0)
                else:
                    fund_income = _get_fund_income_for_month(session, workspace_id, f.id, y, m)

                # Self-funding credits: credits from this fund's txns on WC-overlapping accounts
                sf_info = sf_map.get(f.id)
                sf_account_ids = set(sf_info["overlapping_account_ids"]) if sf_info else set()
                self_funding_credits = Decimal(0)
                if sf_account_ids:
                    sf_cr = session.query(
                        func.sum(PostingModel.base_amount)
                    ).join(
                        TransactionModel, PostingModel.transaction_id == TransactionModel.id
                    ).filter(
                        non_transfer_filter,
                        PostingModel.base_amount > 0,
                        PostingModel.account_id.in_(sf_account_ids),
                    ).scalar() or 0
                    self_funding_credits = Decimal(str(sf_cr))

                # WC: closing uses actual credits (real money in), minus self-funding deductions
                # Non-WC: closing = Opening + Expected + Fund Income - Debits (all visible columns)
                if f.name == "Working Capital":
                    # Compute self-funding deduction: contributions earmarked for self-funding funds
                    sf_deduction = Decimal(0)
                    for sf_fund_id, sf_info_data in sf_map.items():
                        sf_fund_obj = next((sf for sf in funds if sf.id == sf_fund_id), None)
                        if sf_fund_obj:
                            sf_contrib = _compute_fund_contribution(
                                sf_fund_obj, savings_remainder, allocated_fixed_cost,
                                override_map, y, m, amount_override_map=amount_override_map,
                            )
                            sf_pct = Decimal(str(sf_info_data["self_funding_percentage"])) / 100
                            sf_deduction += sf_contrib * sf_pct
                    self_funding_credits = sf_deduction
                    closing = opening + actual_credits - sf_deduction - actual_debits
                else:
                    actual_credits = Decimal(0)  # Non-WC: Expected already covers it
                    closing = opening + contribution + fund_income - actual_debits

                running_balance = closing
                total_contributions += contribution
                total_fund_income += fund_income

                fund_months.append(FundMonthlyLedgerRow(
                    year=y,
                    month=m,
                    opening_balance=float(opening),
                    contribution=float(contribution),
                    actual_credits=float(actual_credits),
                    actual_debits=float(actual_debits),
                    charge_details=charge_details,
                    fund_income=float(fund_income),
                    closing_balance=float(closing),
                    self_funding_credits=float(self_funding_credits),
                ))

            fund_total_contributions[f.id] = total_contributions

            # Build linked accounts for response
            linked_accounts = [
                LinkedAccountSummary(
                    id=link.account.id,
                    name=link.account.name,
                    institution=link.account.institution,
                    account_currency=link.account.account_currency,
                    allocation_percentage=link.allocation_percentage,
                )
                for link in f.account_links
            ]

            sf_info = sf_map.get(f.id)
            fund_ledgers.append(FundLedgerResponse(
                fund_id=f.id,
                fund_name=f.name,
                emoji=f.emoji or "",
                linked_accounts=linked_accounts,
                months=fund_months,
                total_contributions=float(total_contributions),
                total_fund_income=float(total_fund_income),
                current_balance=float(running_balance),
                is_self_funding=sf_info is not None,
                self_funding_percentage=float(sf_info["self_funding_percentage"]) if sf_info else 0,
                overlapping_account_names=sf_info["overlapping_account_names"] if sf_info else [],
            ))

        # ── Account summaries ──
        # Batch queries: 2 grouped queries instead of 2 per account
        prev_y, prev_m = _prev_month(now.year, now.month)
        _, prev_month_end = _get_month_range(prev_y, prev_m)

        # All-time posting sums grouped by account (single query) — base currency
        alltime_sums = dict(
            session.query(
                PostingModel.account_id,
                func.sum(PostingModel.base_amount),
            ).group_by(PostingModel.account_id).all()
        )

        # All-time native amount sums grouped by account (single query)
        alltime_native_sums = dict(
            session.query(
                PostingModel.account_id,
                func.sum(PostingModel.amount),
            ).group_by(PostingModel.account_id).all()
        )

        # Previous month posting sums grouped by account (single query)
        prev_month_sums = dict(
            session.query(
                PostingModel.account_id,
                func.sum(PostingModel.base_amount),
            ).join(
                TransactionModel, PostingModel.transaction_id == TransactionModel.id
            ).filter(
                TransactionModel.timestamp <= prev_month_end,
            ).group_by(PostingModel.account_id).all()
        )

        # Get workspace base_currency for FX lookups
        workspace = session.query(WorkspaceModel).filter(
            WorkspaceModel.id == workspace_id
        ).first()
        base_currency = workspace.base_currency if workspace else "SGD"

        # Fetch current FX rates for all unique account currencies
        from src.services.price_service import PriceService
        price_service = PriceService()
        unique_currencies = {acc.account_currency for acc in all_accounts if acc.account_currency != base_currency}
        fx_rates = {}
        for ccy in unique_currencies:
            fx_rates[ccy] = price_service.get_fx_rate(ccy, base_currency, session=session)

        account_summaries = []
        for acc in all_accounts:
            starting = Decimal(str(acc.starting_balance or 0))

            # Expected contributions (cumulative, all-time): for each fund linked
            # to this account, sum fund contributions * (account's allocation % / 100)
            expected_contributions = Decimal(0)
            for link in acc.fund_links:
                fund_contrib = fund_total_contributions.get(link.fund_id, Decimal(0))
                alloc_pct = Decimal(str(link.allocation_percentage if link.allocation_percentage is not None else 100))
                expected_contributions += fund_contrib * alloc_pct / 100

            # Actual balance in base currency: starting_balance + sum of all base_amount postings
            actual_postings = alltime_sums.get(acc.id)
            actual_balance = starting + (Decimal(str(actual_postings)) if actual_postings else Decimal(0))

            difference = actual_balance - (starting + expected_contributions)

            # Previous month's actual closing balance (from batch query)
            prev_postings = prev_month_sums.get(acc.id)
            prev_month_balance = starting + (Decimal(str(prev_postings)) if prev_postings else Decimal(0))

            # Current month's expected contribution from all linked funds
            current_month_expected = Decimal(0)
            for link in acc.fund_links:
                fund_cm_contrib = fund_current_month_contribution.get(link.fund_id, Decimal(0))
                alloc_pct = Decimal(str(link.allocation_percentage if link.allocation_percentage is not None else 100))
                current_month_expected += fund_cm_contrib * alloc_pct / 100

            current_month_difference = actual_balance - (prev_month_balance + current_month_expected)

            # Native currency balance: starting_balance + sum of native amounts
            native_postings = alltime_native_sums.get(acc.id)
            native_balance = starting + (Decimal(str(native_postings)) if native_postings else Decimal(0))

            # Mark-to-market
            ccy = acc.account_currency
            current_fx_rate = fx_rates.get(ccy, Decimal(1)) if ccy != base_currency else Decimal(1)
            market_value_base = native_balance * current_fx_rate
            cost_basis_base = actual_balance  # sum of base_amount = historical cost basis
            unrealized_fx_gain = market_value_base - cost_basis_base

            account_summaries.append(AccountTrackerRow(
                account_id=acc.id,
                account_name=acc.name,
                institution=acc.institution,
                account_currency=acc.account_currency,
                starting_balance=float(starting),
                expected_contributions=float(expected_contributions),
                actual_balance=float(actual_balance),
                difference=float(difference),
                prev_month_balance=float(prev_month_balance),
                current_month_expected=float(current_month_expected),
                current_month_difference=float(current_month_difference),
                native_balance=float(native_balance),
                current_fx_rate=float(current_fx_rate),
                market_value_base=float(market_value_base),
                cost_basis_base=float(cost_basis_base),
                unrealized_fx_gain=float(unrealized_fx_gain),
            ))

        # ── Per-account monthly ledger ──
        # (batch queries already computed above, reused here)
        account_ledgers = []
        for acc in all_accounts:
            starting = Decimal(str(acc.starting_balance or 0))
            running = starting
            acc_months = []

            for y, m in months_list:
                opening = running

                # Expected = sum of linked fund contributions * allocation %
                expected = Decimal(0)
                for link in acc.fund_links:
                    fund_contrib = fund_month_contributions.get((link.fund_id, y, m), Decimal(0))
                    alloc_pct = Decimal(str(link.allocation_percentage if link.allocation_percentage is not None else 100))
                    expected += fund_contrib * alloc_pct / 100

                credits = acct_monthly_credits.get((acc.id, y, m), Decimal(0))
                debits = acct_monthly_debits.get((acc.id, y, m), Decimal(0))
                closing = opening + credits - debits
                running = closing

                acc_months.append(AccountMonthlyLedgerRow(
                    year=y,
                    month=m,
                    opening_balance=float(opening),
                    expected=float(expected),
                    actual_credits=float(credits),
                    actual_debits=float(debits),
                    closing_balance=float(closing),
                ))

            # FX / mark-to-market for header
            ccy = acc.account_currency
            current_fx_rate = fx_rates.get(ccy, Decimal(1)) if ccy != base_currency else Decimal(1)
            native_postings = alltime_native_sums.get(acc.id)
            native_balance = starting + (Decimal(str(native_postings)) if native_postings else Decimal(0))
            market_value_base = native_balance * current_fx_rate

            account_ledgers.append(AccountLedgerResponse(
                account_id=acc.id,
                account_name=acc.name,
                institution=acc.institution,
                account_currency=ccy,
                current_fx_rate=float(current_fx_rate),
                months=acc_months,
                current_balance=float(running),
                native_balance=float(native_balance),
                market_value_base=float(market_value_base),
            ))

        # ── Summary ──
        total_expected = sum(fl.current_balance for fl in fund_ledgers)
        total_actual = sum(a.actual_balance for a in account_summaries)

        # YTD = current year only
        ytd_contributions = Decimal(0)
        ytd_fund_income = Decimal(0)
        for fl in fund_ledgers:
            for row in fl.months:
                if row.year == current_year:
                    ytd_contributions += Decimal(str(row.contribution))
                    ytd_fund_income += Decimal(str(row.fund_income))

        # ── WC surplus: budget allocated - actual expenses (YTD) ──
        ytd_wc_surplus = Decimal(0)
        for y, m in months_list:
            if y == current_year:
                actual_expenses = _get_expenses_for_month(session, workspace_id, y, m)
                ytd_wc_surplus += budget_benchmark - actual_expenses

        # ── Unallocated remainder: savings not assigned to any fund ──
        # For each month, compute: savings_remainder - sum(non-WC fund contributions)
        unallocated_remainder = Decimal(0)
        for y, m in months_list:
            if y == current_year:
                prev_y, prev_m = _prev_month(y, m)
                net_income = _get_income_for_month(session, workspace_id, prev_y, prev_m)
                savings_rem = net_income - budget_benchmark
                month_allocated = Decimal(0)
                for f in funds:
                    if f.name == "Working Capital":
                        continue
                    month_allocated += _compute_fund_contribution(
                        f, savings_rem, budget_benchmark, override_map, y, m
                    )
                unallocated_remainder += savings_rem - month_allocated

        # ── Transfer suggestions ──
        # Exclude accounts linked to Working Capital (income arrives there naturally)
        wc_account_ids = set()
        wc_primary_account_id = ""
        wc_primary_account_name = ""
        wc_primary_account_currency = "SGD"
        wc_fund_id = None
        for f in funds:
            if f.name == "Working Capital":
                wc_account_ids = {link.account_id for link in f.account_links}
                wc_fund_id = f.id
                if f.account_links:
                    wc_primary_account_id = f.account_links[0].account_id
                    wc_primary_account_name = f.account_links[0].account.name
                    wc_primary_account_currency = f.account_links[0].account.account_currency
                break

        # Build account -> fund lookup for suggestions
        account_fund_map = {}  # account_id -> fund_id
        for f in funds:
            for link in f.account_links:
                if link.account_id not in account_fund_map:
                    account_fund_map[link.account_id] = f.id

        transfer_suggestions = []
        for a in account_summaries:
            if a.account_id in wc_account_ids:
                continue
            # Use current_month_expected (from income allocation model) to cap
            # the suggested transfer.  When the difference is inflated by a
            # legitimate withdrawal we should only ask the user to transfer what
            # the model expects, not the full shortfall.
            if a.current_month_expected > 0 and a.current_month_difference < -0.01:
                suggested = min(abs(a.current_month_difference), a.current_month_expected)
                # Build an explanatory note when the full shortfall exceeds
                # the model-expected contribution (i.e. a withdrawal inflated
                # the gap).
                note = None
                if abs(a.current_month_difference) > a.current_month_expected + 0.01:
                    note = (
                        f"Full shortfall is {abs(a.current_month_difference):,.2f} "
                        f"but only {a.current_month_expected:,.2f} is expected "
                        f"from income allocation this month"
                    )
                transfer_suggestions.append(TransferSuggestion(
                    from_account_name=wc_primary_account_name,
                    from_account_id=wc_primary_account_id,
                    from_currency=wc_primary_account_currency,
                    to_account_name=a.account_name,
                    to_account_id=a.account_id,
                    to_currency=a.account_currency,
                    amount=round(suggested, 2),
                    currency=a.account_currency,
                    source_fund_id=wc_fund_id,
                    dest_fund_id=account_fund_map.get(a.account_id),
                    note=note,
                ))

        # ── WC optimization: if WC balance > 10% above budget benchmark ──
        wc_optimization = None
        for fl in fund_ledgers:
            if fl.fund_name == "Working Capital":
                threshold = float(budget_benchmark) * 1.10
                if fl.current_balance > threshold:
                    wc_optimization = WCOptimization(
                        wc_balance=fl.current_balance,
                        threshold=round(threshold, 2),
                        surplus=round(fl.current_balance - float(budget_benchmark), 2),
                    )
                break

        summary = FundTrackerSummary(
            total_expected=total_expected,
            total_actual=total_actual,
            total_difference=total_actual - total_expected,
            ytd_contributions=float(ytd_contributions),
            ytd_fund_income=float(ytd_fund_income),
            ytd_wc_surplus=float(ytd_wc_surplus),
            unallocated_remainder=float(unallocated_remainder),
            transfer_suggestions=transfer_suggestions,
            wc_optimization=wc_optimization,
        )

        return FundTrackerResponse(
            fund_ledgers=fund_ledgers,
            account_summaries=account_summaries,
            account_ledgers=account_ledgers,
            summary=summary,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Net Worth / Portfolio endpoint ───

@router.get("/net-worth", response_model=NetWorthResponse)
def get_net_worth(
    years: int = Query(default=1, ge=1, le=5),
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """
    Get portfolio / net worth view with mark-to-market FX valuations
    and historical net worth progression.
    """
    try:
        from src.services.price_service import PriceService
        from datetime import date

        price_service = PriceService()

        # Load workspace
        workspace = session.query(WorkspaceModel).filter(
            WorkspaceModel.id == workspace_id
        ).first()
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        base_currency = workspace.base_currency

        # Load all accounts (exclude External)
        all_accounts = session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id,
            AccountModel.is_active == True,
            AccountModel.name != "External"
        ).all()

        # Batch queries: native amounts and base amounts per account
        alltime_native_sums = dict(
            session.query(
                PostingModel.account_id,
                func.sum(PostingModel.amount),
            ).group_by(PostingModel.account_id).all()
        )

        alltime_base_sums = dict(
            session.query(
                PostingModel.account_id,
                func.sum(PostingModel.base_amount),
            ).group_by(PostingModel.account_id).all()
        )

        # Get unique foreign currencies
        unique_currencies = {acc.account_currency for acc in all_accounts if acc.account_currency != base_currency}

        # Fetch current FX rates
        fx_rates = {}
        for ccy in unique_currencies:
            fx_rates[ccy] = price_service.get_fx_rate(ccy, base_currency, session=session)

        # Build per-account rows
        account_rows = []
        total_assets = Decimal(0)
        total_liabilities = Decimal(0)
        total_unrealized_fx_gain = Decimal(0)
        currency_totals = {}  # ccy -> {native: Decimal, base: Decimal}

        for acc in all_accounts:
            starting = Decimal(str(acc.starting_balance or 0))

            # Native balance
            native_postings = alltime_native_sums.get(acc.id)
            native_balance = starting + (Decimal(str(native_postings)) if native_postings else Decimal(0))

            # Cost basis (historical base amounts)
            base_postings = alltime_base_sums.get(acc.id)
            cost_basis = starting + (Decimal(str(base_postings)) if base_postings else Decimal(0))

            # Mark-to-market
            ccy = acc.account_currency
            fx_rate = fx_rates.get(ccy, Decimal(1)) if ccy != base_currency else Decimal(1)
            base_value = native_balance * fx_rate
            unrealized_fx_gain = base_value - cost_basis

            # Sign: liabilities are typically negative or we negate them
            sign = Decimal(1) if acc.type == "asset" else Decimal(-1)
            signed_base_value = base_value * sign

            if acc.type == "asset":
                total_assets += base_value
            else:
                total_liabilities += abs(base_value)

            total_unrealized_fx_gain += unrealized_fx_gain

            # Currency breakdown tracking
            if ccy not in currency_totals:
                currency_totals[ccy] = {"native": Decimal(0), "base": Decimal(0)}
            currency_totals[ccy]["native"] += native_balance
            currency_totals[ccy]["base"] += base_value

            account_rows.append(AccountNetWorthRow(
                account_id=acc.id,
                account_name=acc.name,
                institution=acc.institution,
                account_currency=ccy,
                account_type=acc.type,
                native_balance=float(native_balance),
                fx_rate_to_base=float(fx_rate),
                base_value=float(base_value),
                cost_basis=float(cost_basis),
                unrealized_fx_gain=float(unrealized_fx_gain),
            ))

        total_net_worth = total_assets - total_liabilities

        # Currency breakdown
        currency_breakdown = []
        for ccy, totals in sorted(currency_totals.items()):
            pct = (totals["base"] / total_net_worth * 100) if total_net_worth != 0 else Decimal(0)
            currency_breakdown.append(CurrencyBreakdown(
                currency=ccy,
                total_native=float(totals["native"]),
                base_equivalent=float(totals["base"]),
                percentage=float(pct),
            ))

        # FX rates used (for display)
        fx_rates_used = {f"{ccy}/{base_currency}": float(rate) for ccy, rate in fx_rates.items()}

        # ── Historical net worth ──
        now = datetime.utcnow()
        current_year = now.year
        start_year = current_year - years + 1

        # Build month list
        history_months = []
        for y in range(start_year, current_year + 1):
            for m in range(1, 13):
                if y == current_year and m > now.month:
                    break
                history_months.append((y, m))

        # Backfill historical FX rates for foreign currencies
        if unique_currencies and history_months:
            hist_start = date(history_months[0][0], history_months[0][1], 1)
            hist_end = date(now.year, now.month, now.day)
            for ccy in unique_currencies:
                price_service.get_historical_rates(
                    ccy, base_currency, hist_start, hist_end, session=session
                )

        # Compute historical net worth per month
        history = []
        for y, m in history_months:
            _, last_day = monthrange(y, m)
            month_end = datetime(y, m, last_day, 23, 59, 59)

            # Native balances at month-end per account
            month_native_sums = dict(
                session.query(
                    PostingModel.account_id,
                    func.sum(PostingModel.amount),
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id
                ).filter(
                    TransactionModel.timestamp <= month_end,
                ).group_by(PostingModel.account_id).all()
            )

            month_assets = Decimal(0)
            month_liabilities = Decimal(0)

            for acc in all_accounts:
                starting = Decimal(str(acc.starting_balance or 0))
                native_p = month_native_sums.get(acc.id)
                native_bal = starting + (Decimal(str(native_p)) if native_p else Decimal(0))

                ccy = acc.account_currency
                if ccy == base_currency:
                    rate = Decimal(1)
                else:
                    rate = price_service.get_rate_at_date(
                        ccy, base_currency, date(y, m, last_day), session=session
                    )

                base_val = native_bal * rate

                if acc.type == "asset":
                    month_assets += base_val
                else:
                    month_liabilities += abs(base_val)

            history.append(NetWorthHistoryPoint(
                year=y,
                month=m,
                net_worth=float(month_assets - month_liabilities),
                assets=float(month_assets),
                liabilities=float(month_liabilities),
            ))

        return NetWorthResponse(
            base_currency=base_currency,
            total_net_worth=float(total_net_worth),
            total_assets=float(total_assets),
            total_liabilities=float(total_liabilities),
            total_unrealized_fx_gain=float(total_unrealized_fx_gain),
            accounts=account_rows,
            currency_breakdown=currency_breakdown,
            history=history,
            fx_rates_used=fx_rates_used,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Monthly Dashboard schemas ───

class FundCategoryAnalysis(BaseModel):
    """Category-level spending and budget for one fund"""
    category_id: Optional[str] = None
    category_name: str
    category_emoji: str = ""
    amount_spent: float
    budget_allocated: float = 0


class FundDashboardAnalysis(BaseModel):
    """One fund's complete analysis for the monthly dashboard"""
    fund_id: str
    fund_name: str
    fund_emoji: str = ""
    is_working_capital: bool = False
    total_spent: float
    total_budget: float
    fund_balance: float = 0
    categories: List[FundCategoryAnalysis]


class FundExtractionItem(BaseModel):
    """One fund's share of the month's fund extraction"""
    fund_id: str
    fund_name: str
    fund_emoji: str = ""
    percentage: float
    amount: float


class MonthlyDashboardResponse(BaseModel):
    """Full monthly dashboard response"""
    year: int
    month: int
    currency: str = "SGD"
    fund_analyses: List[FundDashboardAnalysis]
    fund_extraction: List[FundExtractionItem]


# ─── Monthly Dashboard endpoint ───

@router.get("/monthly-dashboard", response_model=MonthlyDashboardResponse)
def get_monthly_dashboard(
    year: int,
    month: int,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session),
):
    """
    Get monthly dashboard data: per-fund spending vs budget by category,
    plus fund extraction (allocation split) for the month.
    """
    try:
        from src.data.repositories import ScenarioRepository, FundAllocationOverrideRepository
        from sqlalchemy.orm import joinedload

        # ── Load funds with account links (needed for balance computation) ──
        funds = session.query(FundModel).options(
            joinedload(FundModel.account_links).joinedload(FundAccountLinkModel.account)
        ).filter(
            FundModel.workspace_id == workspace_id,
            FundModel.is_active == True,
        ).order_by(FundModel.created_at).all()

        # ── Active scenario for budget benchmarks ──
        scenario_repo = ScenarioRepository(session)
        active_scenario = scenario_repo.read_active(workspace_id)
        budget_benchmark = Decimal(str(active_scenario.monthly_expenses_total)) if active_scenario else Decimal(0)

        # Parse category budgets from scenario assumptions
        category_budgets_map: Dict[str, Decimal] = {}
        if active_scenario and active_scenario.assumptions_json:
            assumptions = json.loads(active_scenario.assumptions_json)
            for cb in assumptions.get("category_budgets", []):
                cat_id = cb.get("category_id")
                amount = cb.get("monthly_amount", 0)
                if cat_id:
                    category_budgets_map[cat_id] = Decimal(str(amount))

        # ── Overrides for fund allocation ──
        override_repo = FundAllocationOverrideRepository(session)
        all_overrides = override_repo.read_by_workspace(workspace_id)
        pct_override_map = {}
        amount_override_map = {}
        for o in all_overrides:
            key = (o.fund_id, o.year, o.month)
            if o.override_amount is not None:
                amount_override_map[key] = Decimal(str(o.override_amount))
            else:
                pct_override_map[key] = Decimal(str(o.allocation_percentage))

        # ── WC fund and balance for sweep ──
        wc_fund = next((f for f in funds if f.name == "Working Capital"), None)
        wc_fund_id = wc_fund.id if wc_fund else None
        sf_map = _compute_self_funding_metadata(funds, wc_fund)

        wc_opening, wc_m_credits, wc_m_debits = _batch_wc_balance(
            session, workspace_id, wc_fund, wc_fund_id
        )
        ws = session.query(WorkspaceModel).filter(WorkspaceModel.id == workspace_id).first()
        min_wc_balance = Decimal(str(ws.min_wc_balance or 0)) if ws else Decimal(0)

        # ── Precompute monthly incomes for all months Jan..selected month ──
        # (avoids redundant queries per fund)
        monthly_incomes: Dict[int, Decimal] = {}
        for m in range(1, month + 1):
            prev_y, prev_m = _prev_month(year, m)
            monthly_incomes[m] = _get_income_for_month(session, workspace_id, prev_y, prev_m)

        allocated_fixed_cost = budget_benchmark

        # ── Pre-compute sweep savings per month ──
        monthly_sweep_savings: Dict[int, Decimal] = {}
        monthly_sweep_wc_amount: Dict[int, Decimal] = {}
        wc_sweep_running = wc_opening
        for m_s in range(1, month + 1):
            K = Decimal(0)
            for f_k in funds:
                if f_k.name == "Working Capital":
                    continue
                sf_k = sf_map.get(f_k.id)
                if not sf_k:
                    continue
                pct_k = pct_override_map.get((f_k.id, year, m_s), Decimal(str(f_k.allocation_percentage)))
                K += pct_k * Decimal(str(sf_k["self_funding_percentage"])) / Decimal(10000)

            wc_key = (wc_fund_id, year, m_s) if wc_fund_id else None
            net_inc = monthly_incomes[m_s]
            actual_costs = _get_expenses_for_month(session, workspace_id, year, m_s)

            if wc_key and wc_key in amount_override_map:
                wc_amt = amount_override_map[wc_key]
            else:
                shortfall = max(Decimal(0), min_wc_balance - wc_sweep_running)
                wc_amt = actual_costs + shortfall

            raw_savings = net_inc - wc_amt
            sav_rem = max(Decimal(0), raw_savings / (1 + K))

            monthly_sweep_savings[m_s] = sav_rem
            monthly_sweep_wc_amount[m_s] = wc_amt

            # Advance running balance
            wc_cr = wc_m_credits.get((year, m_s), Decimal(0))
            wc_db = wc_m_debits.get((year, m_s), Decimal(0))
            sf_deduction = sav_rem * K
            wc_sweep_running = wc_sweep_running + wc_cr - wc_db - sf_deduction

        # Current month's values (for category spending query)
        cur_savings_remainder = monthly_sweep_savings[month]

        # ── External account id for filtering ──
        external_acc = session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id,
            AccountModel.name == "External",
        ).first()
        external_account_id = external_acc.id if external_acc else None

        start, end = _get_month_range(year, month)

        # ── Workspace currency ──
        currency = ws.base_currency if ws else "SGD"

        # ── Per-fund analysis ──
        fund_analyses = []

        for f in funds:
            is_wc = f.name == "Working Capital"

            # Fund's expected contribution for selected month
            cur_sweep_wc = monthly_sweep_wc_amount[month]
            contribution = _compute_fund_contribution(
                f, cur_savings_remainder, allocated_fixed_cost, pct_override_map, year, month,
                amount_override_map=amount_override_map,
                default_wc_amount=cur_sweep_wc,
            )

            # ── Compute fund's opening balance for the selected month ──
            # Same logic as fund tracker ledger: start + contributions + fund_income - debits
            fund_balance = Decimal(0)
            # Opening balance from linked accounts
            for link in f.account_links:
                acct_start = Decimal(str(link.account.starting_balance or 0))
                alloc_pct = Decimal(str(link.allocation_percentage if link.allocation_percentage is not None else 100))
                fund_balance += acct_start * alloc_pct / 100
            # Accumulate contributions, fund income, and debits for all prior months
            for m in range(1, month):
                m_savings = monthly_sweep_savings[m]
                m_sweep_wc = monthly_sweep_wc_amount[m]
                m_contrib = _compute_fund_contribution(
                    f, m_savings, allocated_fixed_cost, pct_override_map, year, m,
                    amount_override_map=amount_override_map,
                    default_wc_amount=m_sweep_wc,
                )
                fund_balance += m_contrib
                # Fund income (non-WC only)
                if not is_wc:
                    fund_balance += _get_fund_income_for_month(session, workspace_id, f.id, year, m)
                # Subtract actual debits for prior months (transfer-aware)
                m_start, m_end = _get_month_range(year, m)
                ext_filt = [PostingModel.account_id != external_account_id] if external_account_id else []
                # Non-transfer debits
                prior_debits_nt = session.query(
                    func.sum(PostingModel.base_amount),
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id,
                ).filter(
                    TransactionModel.workspace_id == workspace_id,
                    or_(TransactionModel.type.is_(None), TransactionModel.type != "transfer"),
                    TransactionModel.fund_id == f.id,
                    TransactionModel.timestamp >= m_start,
                    TransactionModel.timestamp <= m_end,
                    PostingModel.base_amount < 0,
                    *ext_filt,
                ).scalar() or Decimal(0)
                # Transfer source debits
                prior_debits_tf = session.query(
                    func.sum(PostingModel.base_amount),
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id,
                ).filter(
                    TransactionModel.workspace_id == workspace_id,
                    TransactionModel.type == "transfer",
                    TransactionModel.source_fund_id == f.id,
                    TransactionModel.timestamp >= m_start,
                    TransactionModel.timestamp <= m_end,
                    PostingModel.base_amount < 0,
                    *ext_filt,
                ).scalar() or Decimal(0)
                # Transfer dest credits
                prior_credits_tf = session.query(
                    func.sum(PostingModel.base_amount),
                ).join(
                    TransactionModel, PostingModel.transaction_id == TransactionModel.id,
                ).filter(
                    TransactionModel.workspace_id == workspace_id,
                    TransactionModel.type == "transfer",
                    TransactionModel.dest_fund_id == f.id,
                    TransactionModel.timestamp >= m_start,
                    TransactionModel.timestamp <= m_end,
                    PostingModel.base_amount > 0,
                    *ext_filt,
                ).scalar() or Decimal(0)
                fund_balance += prior_debits_nt + prior_debits_tf  # negative values subtract
                fund_balance += prior_credits_tf  # positive value adds

            # Query expense transactions tagged to this fund, grouped by category
            # Exclude transfers (they have no category and are tracked separately)
            base_filters = [
                TransactionModel.workspace_id == workspace_id,
                TransactionModel.fund_id == f.id,
                or_(TransactionModel.type.is_(None), TransactionModel.type != "transfer"),
                TransactionModel.timestamp >= start,
                TransactionModel.timestamp <= end,
            ]
            ext_filter = [PostingModel.account_id != external_account_id] if external_account_id else []

            spend_q = session.query(
                TransactionModel.category_id,
                CategoryModel.name,
                CategoryModel.emoji,
                func.sum(PostingModel.base_amount).label("total"),
            ).join(
                PostingModel, TransactionModel.id == PostingModel.transaction_id,
            ).outerjoin(
                CategoryModel, TransactionModel.category_id == CategoryModel.id,
            ).filter(
                *base_filters,
                *ext_filter,
                PostingModel.base_amount < 0,
            ).group_by(
                TransactionModel.category_id,
                CategoryModel.name,
                CategoryModel.emoji,
            )

            spend_rows = spend_q.all()

            # Build category spending map
            cat_spend: Dict[str, tuple] = {}
            total_spent = Decimal(0)
            for cat_id, cat_name, cat_emoji, total in spend_rows:
                if total:
                    amt = abs(Decimal(str(total)))
                    total_spent += amt
                    key = cat_id or "__uncategorized__"
                    cat_spend[key] = (cat_name or "Uncategorized", cat_emoji or "", amt)

            # Build category list for this fund
            categories = []

            if is_wc:
                # For WC: only include categories that have actual spending
                # Show budget alongside for categories that have both
                for cat_id, (cat_name, cat_emoji, spent) in cat_spend.items():
                    budget_amt = category_budgets_map.get(
                        cat_id if cat_id != "__uncategorized__" else "", Decimal(0)
                    )
                    categories.append(FundCategoryAnalysis(
                        category_id=cat_id if cat_id != "__uncategorized__" else None,
                        category_name=cat_name,
                        category_emoji=cat_emoji,
                        amount_spent=float(spent),
                        budget_allocated=float(budget_amt),
                    ))
                total_budget = float(allocated_fixed_cost)
            else:
                # For non-WC: show category breakdown of spending, no per-category budget
                for cat_id, (cat_name, cat_emoji, spent) in cat_spend.items():
                    categories.append(FundCategoryAnalysis(
                        category_id=cat_id if cat_id != "__uncategorized__" else None,
                        category_name=cat_name,
                        category_emoji=cat_emoji,
                        amount_spent=float(spent),
                        budget_allocated=0,
                    ))
                total_budget = float(contribution)

            # Sort categories by amount_spent desc, then budget desc
            categories.sort(key=lambda c: (c.amount_spent, c.budget_allocated), reverse=True)

            fund_analyses.append(FundDashboardAnalysis(
                fund_id=f.id,
                fund_name=f.name,
                fund_emoji=f.emoji or "",
                is_working_capital=is_wc,
                total_spent=float(total_spent),
                total_budget=total_budget,
                fund_balance=float(fund_balance),
                categories=categories,
            ))

        # ── Fund Extraction: actual debits per fund (non-external postings) ──
        grand_total_spent = sum(fa.total_spent for fa in fund_analyses)
        fund_extraction_items = []
        for fa in fund_analyses:
            pct = (fa.total_spent / grand_total_spent * 100) if grand_total_spent > 0 else 0
            fund_extraction_items.append(FundExtractionItem(
                fund_id=fa.fund_id,
                fund_name=fa.fund_name,
                fund_emoji=fa.fund_emoji,
                percentage=round(pct, 1),
                amount=round(fa.total_spent, 2),
            ))

        return MonthlyDashboardResponse(
            year=year,
            month=month,
            currency=currency,
            fund_analyses=fund_analyses,
            fund_extraction=fund_extraction_items,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
