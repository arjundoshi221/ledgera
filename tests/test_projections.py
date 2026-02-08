"""Tests for projection engine"""

import pytest
from decimal import Decimal
from src.domain.projections import ProjectionEngine, ProjectionAssumptions


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
