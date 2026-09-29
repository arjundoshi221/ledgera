"""Categorization rules endpoints (B53).

Rules are the durable knowledge base of how this user categorizes their
spending. They apply automatically at CSV import time and can also be
retroactively applied to existing uncategorized transactions.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.api.deps import get_workspace_id
from src.api.errors import NotFound
from src.api.schemas import (
    ApplyRuleResult,
    CategorizationRuleCreate,
    CategorizationRuleResponse,
    CategorizationRuleUpdate,
)
from src.data.database import get_session
from src.data.models import CategorizationRuleModel, TransactionModel
from src.data.repositories import CategorizationRuleRepository
from src.services.categorization_service import _matches

router = APIRouter()


_VALID_MATCH_TYPES = {"contains", "starts_with", "equals", "regex"}
_VALID_MATCH_FIELDS = {"payee", "memo", "payee_or_memo"}
_VALID_TYPE_OVERRIDES = {"income", "expense", "transfer", None}


def _validate_rule_fields(
    match_type: str | None,
    match_field: str | None,
    transaction_type_override: str | None,
) -> None:
    """Raise 400 on obviously bad inputs. Regex compile errors are handled at match time (never raise)."""
    if match_type is not None and match_type not in _VALID_MATCH_TYPES:
        raise HTTPException(400, f"match_type must be one of {sorted(_VALID_MATCH_TYPES)}")
    if match_field is not None and match_field not in _VALID_MATCH_FIELDS:
        raise HTTPException(400, f"match_field must be one of {sorted(_VALID_MATCH_FIELDS)}")
    if transaction_type_override not in _VALID_TYPE_OVERRIDES:
        raise HTTPException(400, f"transaction_type_override must be one of {sorted(str(v) for v in _VALID_TYPE_OVERRIDES)}")


@router.get("", response_model=list[CategorizationRuleResponse])
def list_rules(
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session),
):
    """List all rules (active + inactive) for the current workspace, ordered by priority."""
    repo = CategorizationRuleRepository(session)
    return repo.read_all_by_workspace(workspace_id)


@router.post("", response_model=CategorizationRuleResponse)
def create_rule(
    rule: CategorizationRuleCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session),
):
    """Create a new rule. Empty match_value is rejected (would match everything)."""
    if not rule.match_value or not rule.match_value.strip():
        raise HTTPException(400, "match_value must be non-empty")
    _validate_rule_fields(rule.match_type, rule.match_field, rule.transaction_type_override)

    db_rule = CategorizationRuleModel(
        workspace_id=workspace_id,
        priority=rule.priority,
        match_type=rule.match_type,
        match_field=rule.match_field,
        match_value=rule.match_value.strip(),
        normalized_payee=rule.normalized_payee,
        category_id=rule.category_id,
        subcategory_id=rule.subcategory_id,
        fund_id=rule.fund_id,
        transaction_type_override=rule.transaction_type_override,
        is_active=rule.is_active,
    )
    repo = CategorizationRuleRepository(session)
    return repo.create(db_rule)


@router.patch("/{rule_id}", response_model=CategorizationRuleResponse)
def update_rule(
    rule_id: str,
    patch: CategorizationRuleUpdate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session),
):
    repo = CategorizationRuleRepository(session)
    rule = repo.read_for_workspace(rule_id, workspace_id)
    if not rule:
        raise NotFound("Rule not found", rule_id=rule_id)

    _validate_rule_fields(patch.match_type, patch.match_field, patch.transaction_type_override)

    # Apply provided fields only — Pydantic's model_dump(exclude_unset=True) is
    # exactly the "partial update" primitive we want.
    for field, value in patch.model_dump(exclude_unset=True).items():
        if field == "match_value" and (not value or not str(value).strip()):
            raise HTTPException(400, "match_value must be non-empty")
        setattr(rule, field, value.strip() if field == "match_value" else value)

    return repo.update(rule)


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session),
):
    repo = CategorizationRuleRepository(session)
    rule = repo.read_for_workspace(rule_id, workspace_id)
    if not rule:
        raise NotFound("Rule not found", rule_id=rule_id)
    repo.delete(rule_id)
    return {"message": "Rule deleted"}


@router.post("/{rule_id}/apply-to-existing", response_model=ApplyRuleResult)
def apply_rule_to_existing(
    rule_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session),
):
    """Apply this rule retroactively to all matching UNCATEGORIZED transactions
    in the workspace. Never overwrites an existing category/fund — the user
    already made a choice on those rows, and we don't second-guess it.
    """
    repo = CategorizationRuleRepository(session)
    rule = repo.read_for_workspace(rule_id, workspace_id)
    if not rule:
        raise NotFound("Rule not found", rule_id=rule_id)

    # Scan all transactions in the workspace where at least one categorization
    # slot the rule can fill is empty. Rule only touches empty slots — so if
    # the user already picked a category, we never touch category (but may
    # still fill in fund/subcategory if the rule provides them).
    candidates = session.query(TransactionModel).filter(
        TransactionModel.workspace_id == workspace_id,
    ).all()

    matched = 0
    updated = 0
    for tx in candidates:
        if not _matches(rule, tx.payee or "", tx.memo):
            continue
        matched += 1
        changed = False
        if rule.category_id and not tx.category_id:
            tx.category_id = rule.category_id
            changed = True
        if rule.subcategory_id and not tx.subcategory_id:
            tx.subcategory_id = rule.subcategory_id
            changed = True
        if rule.fund_id and not tx.fund_id:
            tx.fund_id = rule.fund_id
            changed = True
        if rule.normalized_payee and (tx.payee != rule.normalized_payee):
            # Payee normalization *does* overwrite: the whole point is to
            # rewrite bank gibberish. If the user manually edited a payee to
            # something clean, they can skip this by making the rule inactive.
            tx.payee = rule.normalized_payee
            changed = True
        if changed:
            updated += 1

    if updated > 0:
        session.commit()

    return ApplyRuleResult(rule_id=rule_id, matched_count=matched, updated_count=updated)
