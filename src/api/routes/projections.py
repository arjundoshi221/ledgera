"""Projection endpoints"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from decimal import Decimal

from src.data.database import get_session
from src.domain.projections import ProjectionEngine, ProjectionAssumptions
from src.api.schemas import ProjectionAssumptions as ProjectionAssumptionsSchema, ProjectionResponse, MonthlyProjectionResponse

router = APIRouter()


@router.post("/forecast")
def create_forecast(
    assumptions: ProjectionAssumptionsSchema,
    months: int = 12,
    session: Session = Depends(get_session)
):
    """Generate projection forecast"""
    
    # Convert schema to domain model
    domain_assumptions = ProjectionAssumptions(
        base_currency=assumptions.base_currency,
        monthly_salary=assumptions.monthly_salary,
        annual_bonus=assumptions.annual_bonus,
        other_income=Decimal(0),
        tax_rate=assumptions.tax_rate,
        monthly_expenses=assumptions.monthly_expenses,
        expense_inflation_rate=assumptions.expense_inflation_rate,
        allocation_weights=assumptions.allocation_weights or {},
        bucket_returns=assumptions.bucket_returns or {},
    )
    
    # Run projection
    engine = ProjectionEngine(domain_assumptions)
    projections = engine.project_period(months)
    
    # Convert to response
    monthly_responses = [
        MonthlyProjectionResponse(
            period=p.period,
            gross_income=p.gross_income,
            taxes=p.taxes,
            net_income=p.net_income,
            expenses=p.expenses,
            savings=p.savings,
            savings_rate=p.savings_rate,
            bucket_allocations=p.bucket_allocations or {},
            bucket_balances=p.bucket_balances or {}
        )
        for p in projections
    ]
    
    return {
        "scenario_id": "default",
        "months": monthly_responses
    }


@router.get("/scenarios")
def list_projection_scenarios(session: Session = Depends(get_session)):
    """List projection scenarios"""
    # TODO: Implement scenario listing from database
    return []
