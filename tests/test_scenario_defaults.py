"""F3: scenario defaults derived from actual transactions."""

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from tests.conftest import firebase_signup


def _auth(client, firebase_verify, suffix: str) -> dict:
    data = firebase_signup(
        client, firebase_verify,
        token=f"tok-def-{suffix}", uid=f"fb-uid-def-{suffix}",
        email=f"def-{suffix}@example.com",
    )
    return {"Authorization": f"Bearer {data['access_token']}"}


def _make_account(client: TestClient, headers: dict, name: str = "DBS") -> str:
    resp = client.post(
        "/api/v1/accounts", headers=headers,
        json={
            "name": name, "account_type": "asset", "currency": "SGD",
            "institution": "Test", "starting_balance": "0",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _external(client: TestClient, headers: dict) -> str:
    return next(a["id"] for a in client.get("/api/v1/accounts", headers=headers).json() if a["name"] == "External")


def _post_transaction(
    client: TestClient, headers: dict, *, account_id: str, external_id: str,
    amount: float, timestamp: str, payee: str, fund_id: str | None = None,
    category_id: str | None = None,
) -> None:
    body = {
        "timestamp": timestamp, "payee": payee, "memo": "", "status": "cleared",
        "source": "manual",
        "postings": [
            {"account_id": account_id, "amount": amount, "currency": "SGD", "fx_rate": 1},
            {"account_id": external_id, "amount": -amount, "currency": "SGD", "fx_rate": 1},
        ],
    }
    if fund_id:
        body["fund_id"] = fund_id
    if category_id:
        body["category_id"] = category_id
    resp = client.post("/api/v1/transactions", headers=headers, json=body)
    assert resp.status_code == 200, resp.text


class TestScenarioDefaults:
    def test_empty_workspace_returns_zeros(self, client: TestClient, firebase_verify):
        headers = _auth(client, firebase_verify, "empty")
        r = client.get("/api/v1/analytics/scenario-defaults", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["monthly_income"]["n_months_observed"] == 0
        assert body["monthly_income"]["median"] == 0.0
        assert body["monthly_fixed_costs"]["n_months_observed"] == 0
        assert body["monthly_savings_rate"] == 0.0
        assert body["lookback_months"] == 3

    def test_lookback_param(self, client: TestClient, firebase_verify):
        headers = _auth(client, firebase_verify, "lookback")
        r = client.get("/api/v1/analytics/scenario-defaults?lookback_months=6", headers=headers)
        assert r.status_code == 200
        assert r.json()["lookback_months"] == 6

    def test_lookback_out_of_bounds_rejected(self, client: TestClient, firebase_verify):
        headers = _auth(client, firebase_verify, "bounds")
        r = client.get("/api/v1/analytics/scenario-defaults?lookback_months=0", headers=headers)
        assert r.status_code == 422
        r = client.get("/api/v1/analytics/scenario-defaults?lookback_months=25", headers=headers)
        assert r.status_code == 422

    def test_currency_from_workspace(self, client: TestClient, firebase_verify):
        headers = _auth(client, firebase_verify, "ccy")
        r = client.get("/api/v1/analytics/scenario-defaults", headers=headers)
        body = r.json()
        # Default workspace base currency is USD (per _create_workspace_and_defaults).
        # Any string is fine; just verify it's populated.
        assert isinstance(body["currency"], str)
        assert len(body["currency"]) == 3

    def test_with_actuals_computes_median(self, client: TestClient, firebase_verify):
        """Post income/expense transactions to prior months → defaults reflect medians.

        _get_income_for_month / _get_expenses_for_month require a category_id
        with the correct type, so we seed a Salary (income) and Rent (expense)
        category before posting.
        """
        headers = _auth(client, firebase_verify, "actuals")
        account_id = _make_account(client, headers)
        ext = _external(client, headers)

        salary_cat = client.post(
            "/api/v1/categories", headers=headers,
            json={"name": "Salary", "type": "income"},
        ).json()["id"]
        rent_cat = client.post(
            "/api/v1/categories", headers=headers,
            json={"name": "Rent", "type": "expense"},
        ).json()["id"]

        now = datetime.now(UTC)
        def _step_back(months_ago: int) -> tuple[int, int]:
            y, m = now.year, now.month
            for _ in range(months_ago):
                m -= 1
                if m == 0:
                    m = 12
                    y -= 1
            return y, m

        salaries = [6000, 7000, 5000]  # median = 6000
        expenses = [2000, 3000, 2500]  # median = 2500
        for i, (income, expense) in enumerate(zip(salaries, expenses)):
            y, m = _step_back(i + 1)  # 1..3 months back
            _post_transaction(
                client, headers,
                account_id=account_id, external_id=ext,
                amount=float(income), timestamp=f"{y:04d}-{m:02d}-15T10:00:00",
                payee=f"Salary {y}-{m}", category_id=salary_cat,
            )
            _post_transaction(
                client, headers,
                account_id=account_id, external_id=ext,
                amount=-float(expense), timestamp=f"{y:04d}-{m:02d}-16T10:00:00",
                payee=f"Rent {y}-{m}", category_id=rent_cat,
            )

        r = client.get("/api/v1/analytics/scenario-defaults?lookback_months=3", headers=headers)
        body = r.json()
        assert body["monthly_income"]["n_months_observed"] == 3
        assert body["monthly_income"]["median"] == 6000.0
        assert body["monthly_fixed_costs"]["n_months_observed"] == 3
        assert body["monthly_fixed_costs"]["median"] == 2500.0
        # savings_rate ≈ 1 - 2500/6000 ≈ 0.5833
        assert abs(body["monthly_savings_rate"] - 0.5833) < 0.001
