"""Tests for projection engine"""

import pytest
from decimal import Decimal
from src.domain.projections import ProjectionEngine, ProjectionAssumptions, CategoryBudget, OneTimeCost


def test_projection_single_month():
    """Test single month projection"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        allocation_weights={"cash": Decimal("0.5"), "invest": Decimal("0.5")},
        bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.08")}
    )
    
    engine = ProjectionEngine(assumptions)
    projection = engine.project_month(0)
    
    assert projection.gross_income == Decimal(5000)
    assert projection.taxes == Decimal(1000)
    assert projection.net_income == Decimal(4000)
    assert projection.expenses == Decimal(3000)
    assert projection.savings == Decimal(1000)


def test_projection_multiple_months():
    """Test multiple month projection"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        expense_inflation_rate=Decimal(0),
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )
    
    engine = ProjectionEngine(assumptions)
    projections = engine.project_period(12)
    
    assert len(projections) == 12
    
    # Check that savings accumulate
    for i, proj in enumerate(projections):
        assert proj.savings == Decimal(1000)


def test_projection_with_inflation():
    """Test projection with expense inflation"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        expense_inflation_rate=Decimal("0.12"),  # 12% annual = 1% monthly
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )
    
    engine = ProjectionEngine(assumptions)
    projections = engine.project_period(12)
    
    # Expenses should increase month-to-month
    assert projections[0].expenses < projections[11].expenses


def test_projection_with_category_budgets():
    """Test projection with category-based expenses"""
    category_budgets = [
        CategoryBudget(category_id="cat_housing", monthly_amount=Decimal(2000)),
        CategoryBudget(category_id="cat_food", monthly_amount=Decimal(800)),
        CategoryBudget(category_id="cat_transport", monthly_amount=Decimal(200)),
    ]

    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        category_budgets=category_budgets,
        expense_inflation_rate=Decimal(0),
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )

    engine = ProjectionEngine(assumptions)
    projection = engine.project_month(0)

    # Check total expenses
    assert projection.expenses == Decimal(3000)  # 2000 + 800 + 200

    # Check expense breakdown
    assert projection.expense_breakdown["cat_housing"] == Decimal(2000)
    assert projection.expense_breakdown["cat_food"] == Decimal(800)
    assert projection.expense_breakdown["cat_transport"] == Decimal(200)

    # Check savings
    assert projection.savings == Decimal(1000)  # 4000 net - 3000 expenses


def test_projection_category_with_per_category_inflation():
    """Test categories with different inflation rates"""
    category_budgets = [
        CategoryBudget(
            category_id="cat_rent",
            monthly_amount=Decimal(2000),
            inflation_override=Decimal("0.05")  # 5% annual
        ),
        CategoryBudget(
            category_id="cat_food",
            monthly_amount=Decimal(800),
            inflation_override=Decimal("0.10")  # 10% annual
        ),
    ]

    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        category_budgets=category_budgets,
        expense_inflation_rate=Decimal("0.03"),  # Default 3% (unused with overrides)
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )

    engine = ProjectionEngine(assumptions)
    projections = engine.project_period(12)

    # Month 0: base amounts
    assert projections[0].expense_breakdown["cat_rent"] == Decimal(2000)
    assert projections[0].expense_breakdown["cat_food"] == Decimal(800)

    # Month 11: should have inflated differently
    # Rent at 5% annual should be lower than food at 10% annual
    rent_growth = projections[11].expense_breakdown["cat_rent"] / Decimal(2000)
    food_growth = projections[11].expense_breakdown["cat_food"] / Decimal(800)
    assert food_growth > rent_growth


def test_projection_backward_compatibility_flat_expenses():
    """Test that legacy flat monthly_expenses still works"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),  # Legacy flat amount
        expense_inflation_rate=Decimal(0),
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )

    engine = ProjectionEngine(assumptions)
    projection = engine.project_month(0)

    assert projection.expenses == Decimal(3000)
    assert projection.expense_breakdown == {}  # No breakdown for legacy mode
    assert projection.savings == Decimal(1000)


def test_projection_with_one_time_costs():
    """Test projection with one-time costs"""
    one_time_costs = [
        OneTimeCost(
            name="Vacation",
            amount=Decimal(5000),
            month_index=6,  # Mid-year vacation
            notes="Summer trip to Europe"
        ),
        OneTimeCost(
            name="Car Repair",
            amount=Decimal(2000),
            month_index=3,
            notes="Unexpected repair"
        ),
    ]

    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(8000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        expense_inflation_rate=Decimal(0),
        one_time_costs=one_time_costs,
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )

    engine = ProjectionEngine(assumptions)
    projections = engine.project_period(12)

    # Month 0: No one-time costs
    assert projections[0].one_time_costs == Decimal(0)
    assert projections[0].savings == Decimal(3400)  # 6400 net - 3000 expenses

    # Month 3: Car repair
    assert projections[3].one_time_costs == Decimal(2000)
    assert projections[3].savings == Decimal(1400)  # 6400 - 3000 - 2000
    assert len(projections[3].one_time_costs_detail) == 1
    assert projections[3].one_time_costs_detail[0]["name"] == "Car Repair"

    # Month 6: Vacation
    assert projections[6].one_time_costs == Decimal(5000)
    assert projections[6].savings == Decimal(0)  # 6400 - 3000 - 5000 = -1600, clamped to 0
    assert len(projections[6].one_time_costs_detail) == 1
    assert projections[6].one_time_costs_detail[0]["name"] == "Vacation"


def test_projection_one_time_cost_exceeds_savings():
    """Test that negative savings is clamped to zero when one-time cost is large"""
    one_time_costs = [
        OneTimeCost(
            name="House Down Payment",
            amount=Decimal(50000),
            month_index=0
        )
    ]

    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        expense_inflation_rate=Decimal(0),
        one_time_costs=one_time_costs,
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )

    engine = ProjectionEngine(assumptions)
    projection = engine.project_month(0)

    # Net income: 4000, Expenses: 3000, One-time: 50000
    # Savings should be clamped to 0 (not negative)
    assert projection.savings == Decimal(0)
    assert projection.one_time_costs == Decimal(50000)


def test_projection_multiple_one_time_costs_same_month():
    """Test multiple one-time costs in the same month"""
    one_time_costs = [
        OneTimeCost(name="Item 1", amount=Decimal(1000), month_index=5),
        OneTimeCost(name="Item 2", amount=Decimal(1500), month_index=5),
        OneTimeCost(name="Item 3", amount=Decimal(500), month_index=5),
    ]

    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(8000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        expense_inflation_rate=Decimal(0),
        one_time_costs=one_time_costs,
        allocation_weights={"cash": Decimal("1.0")},
        bucket_returns={"cash": Decimal("0.0")}
    )

    engine = ProjectionEngine(assumptions)
    projections = engine.project_period(12)

    # Month 5: All three costs
    assert projections[5].one_time_costs == Decimal(3000)  # 1000 + 1500 + 500
    assert len(projections[5].one_time_costs_detail) == 3
    assert projections[5].savings == Decimal(400)  # 6400 - 3000 - 3000


def test_allocation_weights_validation_pass():
    """Test that allocation weights validation passes when sum is 1.0"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        allocation_weights={"cash": Decimal("0.3"), "invest": Decimal("0.7")},
        bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.08")}
    )

    # Should not raise
    engine = ProjectionEngine(assumptions)
    projection = engine.project_month(0)
    assert projection.savings == Decimal(1000)


def test_allocation_weights_validation_fail():
    """Test that allocation weights validation fails when sum is not 1.0"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        allocation_weights={"cash": Decimal("0.3"), "invest": Decimal("0.5")},  # Only 0.8, not 1.0
        bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.08")}
    )

    with pytest.raises(ValueError, match="Allocation weights must sum to 1.0"):
        ProjectionEngine(assumptions)


def test_allocation_weights_validation_tolerance():
    """Test that small rounding differences are tolerated"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(5000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        allocation_weights={
            "cash": Decimal("0.33333"),
            "invest": Decimal("0.33333"),
            "other": Decimal("0.33334")  # Sum = 1.00000 (within tolerance)
        },
        bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.08"), "other": Decimal("0.05")}
    )

    # Should not raise due to tolerance
    engine = ProjectionEngine(assumptions)
    projection = engine.project_month(0)
    assert projection.savings == Decimal(1000)


def test_cash_buffer_priority_below_target():
    """Test that cash buffer priority kicks in when below target"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(10000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),  # Target cash = 3000 * 6 = 18000
        expense_inflation_rate=Decimal(0),
        allocation_weights={"cash": Decimal("0.3"), "invest": Decimal("0.7")},
        bucket_returns={"cash": Decimal("0.02"), "invest": Decimal("0.08")},
        minimum_cash_buffer_months=6,
        cash_buffer_bucket_name="cash",
        enforce_cash_buffer=True
    )

    engine = ProjectionEngine(assumptions)

    # Month 0: Cash starts at 0, target is 18000
    # Savings = 8000 - 3000 = 5000
    # Should allocate ALL 5000 to cash (not 30%)
    projection = engine.project_month(0)

    assert projection.savings == Decimal(5000)
    # With buffer priority: cash gets more than normal allocation
    # Normal would be: cash = 5000 * 0.3 = 1500, invest = 3500
    # With priority: cash = 5000, invest = 0
    assert projection.bucket_allocations["cash"] == Decimal(5000)
    assert projection.bucket_allocations["invest"] == Decimal(0)


def test_cash_buffer_priority_above_target():
    """Test that normal allocation happens when cash buffer is met"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(10000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),  # Target cash = 18000
        expense_inflation_rate=Decimal(0),
        allocation_weights={"cash": Decimal("0.3"), "invest": Decimal("0.7")},
        bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.0")},
        minimum_cash_buffer_months=6,
        cash_buffer_bucket_name="cash",
        enforce_cash_buffer=True
    )

    engine = ProjectionEngine(assumptions)

    # Start with cash already at target
    initial_balances = {"cash": Decimal(20000), "invest": Decimal(0)}

    projection = engine.project_month(0, initial_balances)

    # Savings = 5000
    # Cash buffer is met (20000 > 18000), so use normal allocation
    assert projection.bucket_allocations["cash"] == Decimal(1500)  # 5000 * 0.3
    assert projection.bucket_allocations["invest"] == Decimal(3500)  # 5000 * 0.7


def test_cash_buffer_gradual_buildup():
    """Test cash buffer builds up over multiple months"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(10000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),  # Target = 18000
        expense_inflation_rate=Decimal(0),
        allocation_weights={"cash": Decimal("0.4"), "invest": Decimal("0.6")},
        bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.0")},
        minimum_cash_buffer_months=6,
        cash_buffer_bucket_name="cash",
        enforce_cash_buffer=True
    )

    engine = ProjectionEngine(assumptions)
    projections = engine.project_period(12)

    # Track cash balance over time
    # Savings per month = 8000 - 3000 = 5000
    # First few months should prioritize cash

    # Month 0: cash = 5000
    assert projections[0].bucket_balances["cash"] == Decimal(5000)

    # Month 1: cash = 10000
    assert projections[1].bucket_balances["cash"] == Decimal(10000)

    # Month 2: cash = 15000
    assert projections[2].bucket_balances["cash"] == Decimal(15000)

    # Month 3: cash = 18000 (just hit target)
    # This month allocates 5000 to cash, reaching or exceeding target
    assert projections[3].bucket_balances["cash"] >= Decimal(18000)

    # Month 4 onwards: should revert to normal 40/60 split
    # savings = 5000, cash gets 40% = 2000
    month_4_cash_allocation = projections[4].bucket_allocations["cash"]
    assert month_4_cash_allocation == Decimal(2000)


def test_cash_buffer_disabled():
    """Test that buffer rule doesn't apply when disabled"""
    assumptions = ProjectionAssumptions(
        monthly_salary=Decimal(10000),
        tax_rate=Decimal("0.20"),
        monthly_expenses=Decimal(3000),
        expense_inflation_rate=Decimal(0),
        allocation_weights={"cash": Decimal("0.3"), "invest": Decimal("0.7")},
        bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.0")},
        minimum_cash_buffer_months=6,
        cash_buffer_bucket_name="cash",
        enforce_cash_buffer=False  # Disabled
    )

    engine = ProjectionEngine(assumptions)
    projection = engine.project_month(0)

    # Savings = 5000
    # With buffer disabled, should use normal allocation even though cash is 0
    assert projection.bucket_allocations["cash"] == Decimal(1500)  # 5000 * 0.3
    assert projection.bucket_allocations["invest"] == Decimal(3500)  # 5000 * 0.7
