"""Projection endpoints"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from src.data.database import get_session
from src.data.models import ScenarioModel
from src.data.repositories import ScenarioRepository
from src.domain.projections import ProjectionEngine, ProjectionAssumptions, CategoryBudget, SubcategoryBudget, OneTimeCost, FXMapping
from src.api.schemas import (
    ProjectionAssumptions as ProjectionAssumptionsSchema,
    MonthlyProjectionResponse,
    ScenarioCreate, ScenarioResponse, ScenarioListItem,
)
from src.api.deps import get_workspace_id

router = APIRouter()


def _compute_monthly_expenses(assumptions: ProjectionAssumptionsSchema) -> Decimal:
    """Compute total monthly expenses from assumptions."""
    if assumptions.category_budgets:
        total = Decimal(0)
        for cb in assumptions.category_budgets:
            if cb.subcategory_budgets:
                total += sum(Decimal(str(sb.monthly_amount)) for sb in cb.subcategory_budgets)
            else:
                total += Decimal(str(cb.monthly_amount))
        return total
    elif assumptions.monthly_expenses is not None:
        return Decimal(str(assumptions.monthly_expenses))
    return Decimal(0)


def _serialize_assumptions(assumptions: ProjectionAssumptionsSchema) -> str:
    """Serialize assumptions to JSON string.

    Decimals are converted to float so that values remain numeric
    when loaded back from JSON (avoiding string concatenation bugs).
    """
    def _default(obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return str(obj)
    return json.dumps(assumptions.model_dump(), default=_default)


@router.post("/forecast")
def create_forecast(
    assumptions: ProjectionAssumptionsSchema,
    months: int = 12,
    session: Session = Depends(get_session)
):
    """Generate projection forecast"""
    # Convert schema category budgets to domain models
    category_budgets = [
        CategoryBudget(
            category_id=cb.category_id,
            monthly_amount=cb.monthly_amount,
            inflation_override=cb.inflation_override,
            subcategory_budgets=[
                SubcategoryBudget(
                    subcategory_id=sb.subcategory_id,
                    monthly_amount=sb.monthly_amount,
                    inflation_override=sb.inflation_override,
                )
                for sb in cb.subcategory_budgets
            ]
        )
        for cb in assumptions.category_budgets
    ]

    # Convert schema one-time costs to domain models
    one_time_costs = [
        OneTimeCost(
            name=otc.name,
            amount=otc.amount,
            month_index=otc.month_index,
            notes=otc.notes,
            category_id=otc.category_id
        )
        for otc in assumptions.one_time_costs
    ]

    # Convert FX mapping if provided
    fx_mapping = None
    if assumptions.fx_mapping:
        fx_mapping = FXMapping(
            base_currency=assumptions.fx_mapping.base_currency,
            display_currencies=assumptions.fx_mapping.display_currencies,
            rates=assumptions.fx_mapping.rates
        )

    domain_assumptions = ProjectionAssumptions(
        base_currency=assumptions.base_currency,
        start_date=assumptions.start_date,
        monthly_salary=assumptions.monthly_salary,
        annual_bonus=assumptions.annual_bonus,
        other_income=Decimal(0),
        tax_rate=assumptions.tax_rate,
        category_budgets=category_budgets,
        expense_inflation_rate=assumptions.expense_inflation_rate,
        monthly_expenses=assumptions.monthly_expenses,
        one_time_costs=one_time_costs,
        allocation_weights=assumptions.allocation_weights or {},
        bucket_returns=assumptions.bucket_returns or {},
        minimum_cash_buffer_months=assumptions.minimum_cash_buffer_months,
        cash_buffer_bucket_name=assumptions.cash_buffer_bucket_name,
        enforce_cash_buffer=assumptions.enforce_cash_buffer,
        fx_mapping=fx_mapping,
    )

    engine = ProjectionEngine(domain_assumptions)
    projections = engine.project_period(months)

    monthly_responses = [
        {
            "period": p.period,
            "gross_income": p.gross_income,
            "taxes": p.taxes,
            "net_income": p.net_income,
            "expenses": p.expenses,
            "expense_breakdown": p.expense_breakdown or {},
            "one_time_costs": p.one_time_costs,
            "one_time_costs_detail": p.one_time_costs_detail,
            "savings": p.savings,
            "savings_rate": p.savings_rate,
            "bucket_allocations": p.bucket_allocations or {},
            "bucket_balances": p.bucket_balances or {},
            "net_income_fx": p.net_income_fx,
            "total_wealth_fx": p.total_wealth_fx
        }
        for p in projections
    ]

    return {
        "scenario_id": "default",
        "months": monthly_responses
    }


@router.post("/scenarios", response_model=ScenarioResponse)
def save_scenario(
    data: ScenarioCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Save a projection as a named simulation"""
    repo = ScenarioRepository(session)

    if data.is_active:
        repo.deactivate_all(workspace_id)

    scenario = ScenarioModel(
        workspace_id=workspace_id,
        name=data.name,
        description=data.description,
        assumptions_json=_serialize_assumptions(data.assumptions),
        monthly_expenses_total=_compute_monthly_expenses(data.assumptions),
        is_active=data.is_active,
    )
    repo.create(scenario)

    return {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
        "assumptions": json.loads(scenario.assumptions_json),
        "monthly_expenses_total": float(scenario.monthly_expenses_total),
        "is_active": scenario.is_active,
        "created_at": scenario.created_at,
        "updated_at": scenario.updated_at,
    }


@router.get("/scenarios")
def list_scenarios(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """List all saved simulations for workspace"""
    repo = ScenarioRepository(session)
    scenarios = repo.read_by_workspace(workspace_id)
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "monthly_expenses_total": float(s.monthly_expenses_total),
            "is_active": s.is_active,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        }
        for s in scenarios
    ]


@router.get("/scenarios/active")
def get_active_scenario(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get the currently active simulation"""
    repo = ScenarioRepository(session)
    scenario = repo.read_active(workspace_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="No active simulation")
    return {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
        "assumptions": json.loads(scenario.assumptions_json),
        "monthly_expenses_total": float(scenario.monthly_expenses_total),
        "is_active": scenario.is_active,
        "created_at": scenario.created_at,
        "updated_at": scenario.updated_at,
    }


@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def get_scenario(
    scenario_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get a saved simulation with full assumptions"""
    repo = ScenarioRepository(session)
    scenario = repo.read(scenario_id)
    if not scenario or scenario.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
        "assumptions": json.loads(scenario.assumptions_json),
        "monthly_expenses_total": float(scenario.monthly_expenses_total),
        "is_active": scenario.is_active,
        "created_at": scenario.created_at,
        "updated_at": scenario.updated_at,
    }


@router.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(
    scenario_id: str,
    data: ScenarioCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update a saved simulation"""
    repo = ScenarioRepository(session)
    scenario = repo.read(scenario_id)
    if not scenario or scenario.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if data.is_active and not scenario.is_active:
        repo.deactivate_all(workspace_id)

    scenario.name = data.name
    scenario.description = data.description
    scenario.assumptions_json = _serialize_assumptions(data.assumptions)
    scenario.monthly_expenses_total = _compute_monthly_expenses(data.assumptions)
    scenario.is_active = data.is_active
    repo.update(scenario)

    return {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
        "assumptions": json.loads(scenario.assumptions_json),
        "monthly_expenses_total": float(scenario.monthly_expenses_total),
        "is_active": scenario.is_active,
        "created_at": scenario.created_at,
        "updated_at": scenario.updated_at,
    }


@router.patch("/scenarios/{scenario_id}/activate")
def activate_scenario(
    scenario_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Set a simulation as the active budget benchmark"""
    repo = ScenarioRepository(session)
    scenario = repo.read(scenario_id)
    if not scenario or scenario.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if scenario.is_active:
        # Deactivate it
        scenario.is_active = False
        repo.update(scenario)
    else:
        repo.activate(scenario_id, workspace_id)
        scenario = repo.read(scenario_id)

    return {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
        "monthly_expenses_total": float(scenario.monthly_expenses_total),
        "is_active": scenario.is_active,
        "created_at": scenario.created_at,
        "updated_at": scenario.updated_at,
    }


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(
    scenario_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete a saved simulation"""
    repo = ScenarioRepository(session)
    scenario = repo.read(scenario_id)
    if not scenario or scenario.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Scenario not found")
    repo.delete(scenario_id)
    return {"message": "Scenario deleted"}
