"""Categorization rules tests (B53).

The rules engine is DB-free (pure list-of-models in, RuleMatch out) — unit-
testable in isolation. The API surface is tested through the FastAPI test
client. Integration with the import pipeline is tested by parsing a CSV
after seeding a rule and asserting the parsed rows come out with the
right category / normalized payee / type override.
"""

from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient

from src.data.models import CategorizationRuleModel
from src.services.categorization_service import _matches, apply_rules
from tests.conftest import firebase_signup

FIXTURES = Path(__file__).parent / "fixtures"
DBS_SAMPLE = FIXTURES / "dbs_multiplier_sample.csv"

DBS_MAPPING = (
    '{"date": "Transaction Date", "payee": "Description",'
    ' "debit": "Debit Amount", "credit": "Credit Amount"}'
)


def _make_rule(**overrides) -> CategorizationRuleModel:
    """Build a rule model in memory (no session commit) for unit-level tests."""
    now = datetime.now(UTC)
    defaults = {
        "id": "rule-1",
        "workspace_id": "ws-1",
        "priority": 100,
        "match_type": "contains",
        "match_field": "payee_or_memo",
        "match_value": "grab",
        "normalized_payee": None,
        "category_id": None,
        "subcategory_id": None,
        "fund_id": None,
        "transaction_type_override": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    return CategorizationRuleModel(**defaults)


def _auth(client: TestClient, firebase_verify, suffix: str) -> tuple[dict, str]:
    data = firebase_signup(
        client, firebase_verify,
        token=f"tok-cat-{suffix}", uid=f"fb-uid-cat-{suffix}",
        email=f"cat-{suffix}@example.com",
    )
    return {"Authorization": f"Bearer {data['access_token']}"}, data["workspace_id"]


def _create_account(client: TestClient, headers: dict, name: str = "DBS") -> str:
    resp = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={
            "name": name, "account_type": "asset", "currency": "SGD",
            "institution": "TestBank", "starting_balance": "0",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


# ─── Unit tests: _matches and apply_rules (no DB) ───

class TestMatchesUnit:
    def test_contains_is_case_insensitive(self):
        rule = _make_rule(match_type="contains", match_value="GRAB")
        assert _matches(rule, "BAT Grab* AAA111", None) is True
        assert _matches(rule, "bat grab* aaa111", None) is True

    def test_starts_with(self):
        rule = _make_rule(match_type="starts_with", match_value="BAT NTUC")
        assert _matches(rule, "BAT NTUC FairPrice", None) is True
        assert _matches(rule, "Some BAT NTUC middle", None) is False

    def test_equals(self):
        rule = _make_rule(match_type="equals", match_value="Salary")
        assert _matches(rule, "Salary", None) is True
        assert _matches(rule, "Monthly Salary", None) is False

    def test_regex_bad_pattern_never_matches(self):
        rule = _make_rule(match_type="regex", match_value="[invalid")
        # Invalid regex must not crash the parser — silently no-match.
        assert _matches(rule, "anything", None) is False

    def test_regex_valid_pattern(self):
        rule = _make_rule(match_type="regex", match_value=r"^BAT\s+GRAB")
        assert _matches(rule, "BAT GRAB Singapore", None) is True
        assert _matches(rule, "BAT SALADSTOP", None) is False

    def test_match_field_memo_only(self):
        rule = _make_rule(match_type="contains", match_field="memo", match_value="salary")
        assert _matches(rule, "PAYROLL", "Sep 2026 Salary") is True
        assert _matches(rule, "SALARY", None) is False

    def test_empty_match_value_never_matches(self):
        rule = _make_rule(match_value="")
        assert _matches(rule, "anything at all", None) is False

    def test_unknown_match_type_never_matches(self):
        rule = _make_rule(match_type="fuzzy")
        assert _matches(rule, "matches contains-ish", None) is False


class TestApplyRulesUnit:
    def test_first_match_wins(self):
        rules = [
            _make_rule(id="a", priority=10, match_value="grab", normalized_payee="Grab"),
            _make_rule(id="b", priority=20, match_value="bat", normalized_payee="Something Else"),
        ]
        m = apply_rules(rules, "BAT Grab* AAA111", None)
        assert m is not None
        assert m.rule_id == "a"
        assert m.normalized_payee == "Grab"

    def test_no_match_returns_none(self):
        rules = [_make_rule(id="a", match_value="grab")]
        assert apply_rules(rules, "BAT NTUC FairPrice", None) is None

    def test_inactive_rules_skipped(self):
        rules = [
            _make_rule(id="a", match_value="grab", is_active=False, normalized_payee="ShouldNotFire"),
            _make_rule(id="b", match_value="grab", normalized_payee="Grab"),
        ]
        m = apply_rules(rules, "BAT Grab", None)
        assert m is not None and m.rule_id == "b"

    def test_returns_all_effects(self):
        rules = [_make_rule(
            id="r1", match_value="grab",
            normalized_payee="Grab", category_id="cat-transport",
            subcategory_id="sub-ridehail", fund_id="fund-wc",
            transaction_type_override="expense",
        )]
        m = apply_rules(rules, "BAT Grab* AAA", None)
        assert m.normalized_payee == "Grab"
        assert m.category_id == "cat-transport"
        assert m.subcategory_id == "sub-ridehail"
        assert m.fund_id == "fund-wc"
        assert m.transaction_type_override == "expense"


# ─── API surface tests ───

class TestRulesAPI:
    def test_create_and_list(self, client: TestClient, firebase_verify):
        headers, _ = _auth(client, firebase_verify, "api-1")

        resp = client.post(
            "/api/v1/categorization-rules",
            headers=headers,
            json={
                "match_value": "Grab",
                "normalized_payee": "Grab",
                "priority": 10,
            },
        )
        assert resp.status_code == 200, resp.text
        rule_id = resp.json()["id"]

        list_resp = client.get("/api/v1/categorization-rules", headers=headers)
        assert list_resp.status_code == 200
        rules = list_resp.json()
        assert len(rules) == 1
        assert rules[0]["id"] == rule_id
        assert rules[0]["match_value"] == "Grab"
        assert rules[0]["is_active"] is True

    def test_create_rejects_empty_match_value(self, client: TestClient, firebase_verify):
        headers, _ = _auth(client, firebase_verify, "api-2")
        resp = client.post(
            "/api/v1/categorization-rules",
            headers=headers,
            json={"match_value": "   "},
        )
        assert resp.status_code == 400

    def test_create_rejects_bad_match_type(self, client: TestClient, firebase_verify):
        headers, _ = _auth(client, firebase_verify, "api-3")
        resp = client.post(
            "/api/v1/categorization-rules",
            headers=headers,
            json={"match_value": "grab", "match_type": "fuzzy"},
        )
        assert resp.status_code == 400

    def test_update_rule(self, client: TestClient, firebase_verify):
        headers, _ = _auth(client, firebase_verify, "api-4")
        resp = client.post(
            "/api/v1/categorization-rules",
            headers=headers,
            json={"match_value": "grab", "priority": 100},
        )
        rule_id = resp.json()["id"]

        patch = client.patch(
            f"/api/v1/categorization-rules/{rule_id}",
            headers=headers,
            json={"priority": 5, "normalized_payee": "Grab"},
        )
        assert patch.status_code == 200
        assert patch.json()["priority"] == 5
        assert patch.json()["normalized_payee"] == "Grab"
        assert patch.json()["match_value"] == "grab"  # unchanged

    def test_delete_rule(self, client: TestClient, firebase_verify):
        headers, _ = _auth(client, firebase_verify, "api-5")
        resp = client.post(
            "/api/v1/categorization-rules",
            headers=headers,
            json={"match_value": "grab"},
        )
        rule_id = resp.json()["id"]

        d = client.delete(f"/api/v1/categorization-rules/{rule_id}", headers=headers)
        assert d.status_code == 200

        list_resp = client.get("/api/v1/categorization-rules", headers=headers)
        assert list_resp.json() == []

    def test_workspace_isolation(self, client: TestClient, firebase_verify):
        """Rules from one workspace must never leak into another."""
        h_a, _ = _auth(client, firebase_verify, "ws-a")
        h_b, _ = _auth(client, firebase_verify, "ws-b")

        client.post("/api/v1/categorization-rules", headers=h_a,
                    json={"match_value": "onlyA"})

        assert len(client.get("/api/v1/categorization-rules", headers=h_a).json()) == 1
        assert client.get("/api/v1/categorization-rules", headers=h_b).json() == []


# ─── Integration: rules applied at parse time ───

class TestRulesAtParseTime:
    def _parse(self, client: TestClient, headers: dict, account_id: str) -> list[dict]:
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/parse-file",
                headers=headers,
                files={"file": ("dbs.csv", f, "text/csv")},
                data={
                    "account_id": account_id,
                    "file_type": "csv",
                    "column_mapping": DBS_MAPPING,
                },
            )
        assert resp.status_code == 200, resp.text
        return resp.json()["parsed_transactions"]

    def test_rule_normalizes_payee_at_parse(self, client: TestClient, firebase_verify):
        headers, _ = _auth(client, firebase_verify, "parse-1")
        account_id = _create_account(client, headers)

        client.post("/api/v1/categorization-rules", headers=headers, json={
            "match_value": "Grab",
            "normalized_payee": "Grab",
            "priority": 10,
        })

        parsed = self._parse(client, headers, account_id)
        grab_rows = [tx for tx in parsed if tx["payee"] == "Grab"]
        assert len(grab_rows) >= 1, "at least one Grab row should be normalized"
        for tx in grab_rows:
            assert tx["applied_rule_id"] is not None
            # original_payee preserves the noisy bank description.
            assert tx["original_payee"] is not None
            assert "AAA" in tx["original_payee"] or "GRAB" in tx["original_payee"].upper()

    def test_rule_transaction_type_override_wins_over_b52(
        self, client: TestClient, firebase_verify,
    ):
        """B52 classifies PayLah top-ups as transfer. A user rule can force it
        back to expense (e.g. treating PayLah as spend rather than a wallet)."""
        headers, _ = _auth(client, firebase_verify, "parse-2")
        account_id = _create_account(client, headers)

        client.post("/api/v1/categorization-rules", headers=headers, json={
            "match_value": "PAYLAH",
            "transaction_type_override": "expense",
            "priority": 5,
        })

        parsed = self._parse(client, headers, account_id)
        paylah = next(tx for tx in parsed if "PAYLAH" in tx["payee"].upper())
        assert paylah["transaction_type"] == "expense", (
            "rule override must beat B52 classification"
        )
        assert paylah["pending_transfer_destination"] is False

    def test_no_rules_means_no_categorization(self, client: TestClient, firebase_verify):
        """Regression: rules absent → parse behaves exactly as pre-B53."""
        headers, _ = _auth(client, firebase_verify, "parse-3")
        account_id = _create_account(client, headers)

        parsed = self._parse(client, headers, account_id)
        for tx in parsed:
            assert tx["applied_rule_id"] is None
            assert tx["original_payee"] is None


# ─── Integration: apply-to-existing ───

class TestApplyToExisting:
    def test_applies_normalized_payee_to_stored_transactions(
        self, client: TestClient, firebase_verify,
    ):
        headers, _ = _auth(client, firebase_verify, "apply-1")
        account_id = _create_account(client, headers)
        ext_resp = client.get("/api/v1/accounts", headers=headers)
        ext_id = next(a["id"] for a in ext_resp.json() if a["name"] == "External")

        # Manually create a transaction with a noisy payee.
        client.post(
            "/api/v1/transactions", headers=headers,
            json={
                "timestamp": "2026-09-15T10:00:00",
                "payee": "BAT Grab* AAA111 Si SGP 15SEP",
                "memo": "",
                "status": "cleared",
                "source": "manual",
                "postings": [
                    {"account_id": account_id, "amount": -10.0, "currency": "SGD", "fx_rate": 1},
                    {"account_id": ext_id, "amount": 10.0, "currency": "SGD", "fx_rate": 1},
                ],
            },
        )

        # Create a rule AFTER the fact.
        rule_resp = client.post("/api/v1/categorization-rules", headers=headers, json={
            "match_value": "Grab",
            "normalized_payee": "Grab",
        })
        rule_id = rule_resp.json()["id"]

        # Apply retroactively.
        apply = client.post(
            f"/api/v1/categorization-rules/{rule_id}/apply-to-existing",
            headers=headers,
        )
        assert apply.status_code == 200, apply.text
        assert apply.json()["matched_count"] == 1
        assert apply.json()["updated_count"] == 1

        # Verify the payee was rewritten.
        tx_list = client.get("/api/v1/transactions", headers=headers).json()
        assert any(tx["payee"] == "Grab" for tx in tx_list)

    def test_does_not_overwrite_existing_category(
        self, client: TestClient, firebase_verify,
    ):
        """A user who already tagged a transaction manually must not have their
        choice overwritten by a retroactive rule apply."""
        headers, _ = _auth(client, firebase_verify, "apply-2")
        account_id = _create_account(client, headers)
        ext_resp = client.get("/api/v1/accounts", headers=headers)
        ext_id = next(a["id"] for a in ext_resp.json() if a["name"] == "External")

        # Create a category to reference.
        cat_resp = client.post(
            "/api/v1/categories", headers=headers,
            json={"name": "UserPicked", "type": "expense"},
        )
        user_cat_id = cat_resp.json()["id"]

        # Create another category the rule will point at.
        cat_resp2 = client.post(
            "/api/v1/categories", headers=headers,
            json={"name": "RulePicked", "type": "expense"},
        )
        rule_cat_id = cat_resp2.json()["id"]

        # User creates a transaction with THEIR category already set.
        client.post(
            "/api/v1/transactions", headers=headers,
            json={
                "timestamp": "2026-09-15T10:00:00",
                "payee": "BAT Grab AAA111",
                "memo": "",
                "status": "cleared",
                "source": "manual",
                "category_id": user_cat_id,
                "postings": [
                    {"account_id": account_id, "amount": -10.0, "currency": "SGD", "fx_rate": 1},
                    {"account_id": ext_id, "amount": 10.0, "currency": "SGD", "fx_rate": 1},
                ],
            },
        )

        # Rule points to a DIFFERENT category.
        rule_resp = client.post("/api/v1/categorization-rules", headers=headers, json={
            "match_value": "Grab",
            "category_id": rule_cat_id,
        })
        rule_id = rule_resp.json()["id"]

        apply = client.post(
            f"/api/v1/categorization-rules/{rule_id}/apply-to-existing",
            headers=headers,
        )
        assert apply.json()["matched_count"] == 1
        # matched but not updated — user's choice was preserved.
        assert apply.json()["updated_count"] == 0

        tx_list = client.get("/api/v1/transactions", headers=headers).json()
        tx = tx_list[0]
        assert tx["category_id"] == user_cat_id, "user's category must survive rule apply"
