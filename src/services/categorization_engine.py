"""Categorization rules engine"""

from typing import Optional, List, Dict
from dataclasses import dataclass


@dataclass
class CategorizationRule:
    """Rule for auto-categorizing transactions"""
    
    category_id: str
    priority: int = 100
    # Matching criteria (all must match)
    payee_contains: Optional[str] = None
    memo_contains: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None


class CategorizationEngine:
    """Rules-based auto-categorization"""

    def __init__(self):
        """Initialize engine"""
        self.rules: List[CategorizationRule] = []

    def add_rule(self, rule: CategorizationRule) -> None:
        """Add categorization rule"""
        self.rules.append(rule)
        # Sort by priority (higher = evaluated first)
        self.rules.sort(key=lambda r: r.priority, reverse=True)

    def categorize(
        self,
        payee: str,
        memo: str,
        amount: float
    ) -> Optional[str]:
        """
        Determine category for transaction.
        
        Args:
            payee: Transaction payee
            memo: Transaction memo
            amount: Transaction amount
            
        Returns:
            Category ID or None if no match
        """
        for rule in self.rules:
            if self._matches_rule(rule, payee, memo, amount):
                return rule.category_id
        
        return None

    def _matches_rule(
        self,
        rule: CategorizationRule,
        payee: str,
        memo: str,
        amount: float
    ) -> bool:
        """Check if transaction matches rule"""
        
        # Check payee
        if rule.payee_contains:
            if rule.payee_contains.lower() not in payee.lower():
                return False
        
        # Check memo
        if rule.memo_contains:
            if rule.memo_contains.lower() not in memo.lower():
                return False
        
        # Check amount range
        if rule.amount_min is not None and amount < rule.amount_min:
            return False
        
        if rule.amount_max is not None and amount > rule.amount_max:
            return False
        
        return True

    def get_default_categories(self) -> Dict[str, str]:
        """Get suggested default categories"""
        return {
            "salary": "income",
            "bonus": "income",
            "interest": "income",
            "dividends": "income",
            "rent": "expenses",
            "utilities": "expenses",
            "groceries": "expenses",
            "dining": "expenses",
            "transport": "expenses",
            "health": "expenses",
            "entertainment": "expenses",
        }
