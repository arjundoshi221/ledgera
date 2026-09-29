"""Rule-based categorization at CSV import (B53).

Rules are applied in priority order; first match wins. Rules can rewrite the
payee, pin category/subcategory/fund, and optionally override the type
classification from B52.

Matching is deterministic and testable in isolation — the engine takes the
list of rules as input (not a session), so unit tests don't need a DB.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from src.data.models import CategorizationRuleModel


@dataclass
class RuleMatch:
    """Result of applying rules to a single parsed row."""
    rule_id: str
    normalized_payee: str | None  # if the rule provides one; else None (keep original)
    category_id: str | None
    subcategory_id: str | None
    fund_id: str | None
    transaction_type_override: str | None


def _matches(rule: CategorizationRuleModel, payee: str, memo: str | None) -> bool:
    """Return True if the rule matches this row's payee/memo."""
    # Choose the haystack based on match_field.
    if rule.match_field == "payee":
        haystack = payee or ""
    elif rule.match_field == "memo":
        haystack = memo or ""
    else:  # "payee_or_memo" (default)
        haystack = f"{payee or ''} {memo or ''}"

    needle = rule.match_value or ""
    if not needle:
        return False

    # Case-insensitive for all match types except regex (regex users manage
    # their own case flags via inline (?i)).
    hay_lower = haystack.lower()
    needle_lower = needle.lower()

    mt = (rule.match_type or "contains").lower()
    if mt == "contains":
        return needle_lower in hay_lower
    if mt == "starts_with":
        return hay_lower.strip().startswith(needle_lower)
    if mt == "equals":
        return hay_lower.strip() == needle_lower.strip()
    if mt == "regex":
        try:
            return re.search(needle, haystack) is not None
        except re.error:
            # Bad regex is a user error, not a server error — never match, don't crash.
            return False
    # Unknown match_type — never match rather than raise.
    return False


def apply_rules(
    rules: list[CategorizationRuleModel],
    payee: str,
    memo: str | None,
) -> RuleMatch | None:
    """Apply rules in order; return the first match's effects, or None if no rule matches.

    Callers should pass in the pre-fetched *active* rules ordered by priority
    ascending. This function is DB-free — pure Python — so it can be unit-tested
    against a hand-built list of models.
    """
    for rule in rules:
        if not rule.is_active:
            continue
        if _matches(rule, payee, memo):
            return RuleMatch(
                rule_id=rule.id,
                normalized_payee=rule.normalized_payee,
                category_id=rule.category_id,
                subcategory_id=rule.subcategory_id,
                fund_id=rule.fund_id,
                transaction_type_override=rule.transaction_type_override,
            )
    return None
