"""Income allocation endpoint tests (B54).

The /api/v1/analytics/income-allocation endpoint used to emit a row for every
month from `now() - N years` to the current month, whether the workspace had
transactions or not. Config alone (accounts, funds, budget scenarios) would
render a full 12-row grid with false-signaling red/green numbers.

B54 gates row emission on the workspace data floor = min(transaction.timestamp).
Below the floor: no row emitted. Empty workspace: zero rows.
"""

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from tests.conftest import firebase_signup


def _auth(client: TestClient, firebase_verify, suffix: str = "aa") -> tuple[dict, str]:
    data = firebase_signup(
        client, firebase_verify,
        token=f"tok-alloc-{suffix}", uid=f"fb-uid-alloc-{suffix}",
        email=f"alloc-{suffix}@example.com",
    )
    return {"Authorization": f"Bearer {data['access_token']}"}, data["workspace_id"]


def _create_account(client: TestClient, headers: dict, name: str, currency: str = "SGD") -> str:
    resp = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={
            "name": name,
            "account_type": "asset",
            "currency": currency,
            "institution": "TestBank",
            "starting_balance": "0",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _external_account_id(client: TestClient, headers: dict) -> str:
    resp = client.get("/api/v1/accounts", headers=headers)
    assert resp.status_code == 200, resp.text
    return next(a["id"] for a in resp.json() if a["name"] == "External")


def _create_transaction(client: TestClient, headers: dict, *, timestamp: str, payee: str,
                        source_account_id: str, external_account_id: str, amount: float) -> None:
    resp = client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "timestamp": timestamp,
            "payee": payee,
            "memo": "",
            "status": "cleared",
            "postings": [
                {"account_id": source_account_id, "amount": amount, "currency": "SGD", "fx_rate": 1},
                {"account_id": external_account_id, "amount": -amount, "currency": "SGD", "fx_rate": 1},
            ],
        },
    )
    assert resp.status_code == 200, resp.text


class TestDataFloor:
    """B54: rows are gated on the workspace's earliest transaction date."""

    def test_empty_workspace_emits_no_rows(self, client: TestClient, firebase_verify):
        """Freshly signed-up workspace has no transactions → grid must be empty."""
        headers, _ = _auth(client, firebase_verify, "empty")

        resp = client.get("/api/v1/analytics/income-allocation?years=1", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert body["rows"] == [], (
            "empty workspace must not render months. This is the exact regression "
            "from the user screenshot — 12 fake rows appearing before any data existed."
        )
        # Config metadata still populated so the frontend can render its empty state.
        assert "funds_meta" in body
        assert "budget_benchmark" in body

    def test_one_transaction_gates_all_earlier_months(self, client: TestClient, firebase_verify):
        """A single transaction in the current year should yield rows only from
        that month forward, not from January."""
        headers, _ = _auth(client, firebase_verify, "one")

        acct = _create_account(client, headers, "DBS Multiplier")
        ext = _external_account_id(client, headers)

        # Pick a month deliberately in the middle of the current year so we can
        # assert months before it are absent and months at/after are present.
        # Use tz-aware UTC to match the endpoint's own clock (analytics.py uses
        # datetime.now(UTC)); mixing naive and aware clocks flakes across DST.
        now = datetime.now(UTC)
        floor_month = 6 if now.month >= 6 else max(1, now.month - 1)
        floor_year = now.year
        _create_transaction(
            client, headers,
            timestamp=f"{floor_year}-{floor_month:02d}-15T12:00:00",
            payee="TestPayee",
            source_account_id=acct,
            external_account_id=ext,
            amount=100.0,
        )

        resp = client.get("/api/v1/analytics/income-allocation?years=1", headers=headers)
        rows = resp.json()["rows"]
        assert len(rows) > 0

        # Every emitted row is at or after (floor_year, floor_month).
        for r in rows:
            assert (r["year"], r["month"]) >= (floor_year, floor_month), (
                f"row {r['year']}-{r['month']} predates the data floor "
                f"{floor_year}-{floor_month}"
            )

        # And no month before the floor exists in the response.
        pre_floor_months_present = [
            (r["year"], r["month"]) for r in rows
            if (r["year"], r["month"]) < (floor_year, floor_month)
        ]
        assert pre_floor_months_present == []

        # Current month should be present (through the current month).
        current_present = any(
            r["year"] == now.year and r["month"] == now.month for r in rows
        )
        assert current_present, "current month must appear in the grid"

    def test_config_alone_does_not_produce_rows(self, client: TestClient, firebase_verify):
        """Reproducing the reported flaw: creating accounts/funds without any
        transactions must NOT cause the grid to render."""
        headers, _ = _auth(client, firebase_verify, "cfg")

        # Simulate the user's setup: several accounts exist, but zero transactions.
        _create_account(client, headers, "DBS Multiplier")
        _create_account(client, headers, "IBKR Singapore")
        _create_account(client, headers, "Charles Schwab Checking", currency="USD")

        resp = client.get("/api/v1/analytics/income-allocation?years=1", headers=headers)
        assert resp.status_code == 200, resp.text
        rows = resp.json()["rows"]

        assert rows == [], (
            "Accounts exist but there are no transactions. The grid must be empty. "
            "Config (accounts/funds/budget) alone is not evidence of financial history."
        )
