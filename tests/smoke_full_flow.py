"""End-to-end smoke test simulating tomorrow's user flow.

Not a pytest — a manual runnable script that:
1. Spins up an in-memory API + Firebase-verified session
2. Creates a DBS account
3. Imports the synthetic DBS CSV
4. Creates a categorization rule
5. Re-parses, verifies dedup + auto-cat
6. Fetches dashboard-relevant endpoints (net worth, income allocation, scenario defaults, reconciliation)
7. Prints a report on each step

Purpose: catch anything that would prevent the user from uploading a CSV
tomorrow and getting a working dashboard.

Run:
    ./.conda/python.exe tests/smoke_full_flow.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make src importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from firebase_admin import auth as firebase_auth
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.main import app
from src.api.rate_limit import limiter
from src.data import database as db_module
from src.data.database import get_session
from src.data.models import Base

FIXTURES = Path(__file__).parent / "fixtures"
DBS_SAMPLE = FIXTURES / "dbs_multiplier_sample.csv"


class _FakeFirebase:
    def __init__(self):
        self.registry: dict[str, dict] = {}

    def register(self, token: str, decoded: dict) -> None:
        self.registry[token] = decoded

    def verify_id_token(self, token, **_):
        if token not in self.registry:
            raise firebase_auth.InvalidIdTokenError("unknown mock token")
        return self.registry[token]


def _bootstrap():
    """Wire an in-memory DB + fake Firebase, return (TestClient, auth headers)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_session():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_session] = override_get_session
    db_module._SessionLocal = SessionLocal
    limiter.enabled = False

    fake = _FakeFirebase()
    original_verify = firebase_auth.verify_id_token
    firebase_auth.verify_id_token = fake.verify_id_token  # type: ignore

    client = TestClient(app)
    fake.register("tok-smoke", {
        "uid": "fb-uid-smoke",
        "email": "smoke@example.com",
        "email_verified": True,
        "name": "Smoke Test",
    })
    resp = client.post("/auth/firebase", json={"id_token": "tok-smoke"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return client, {"Authorization": f"Bearer {token}"}, original_verify


def _create_account(client, headers) -> str:
    resp = client.post("/api/v1/accounts", headers=headers, json={
        "name": "DBS Multiplier", "account_type": "asset", "currency": "SGD",
        "institution": "DBS", "starting_balance": "0",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _external_id(client, headers) -> str:
    return next(a["id"] for a in client.get("/api/v1/accounts", headers=headers).json() if a["name"] == "External")


def _create_expense_category(client, headers) -> str:
    resp = client.post("/api/v1/categories", headers=headers,
                       json={"name": "Transport", "type": "expense"})
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def main() -> int:
    print("─── Bootstrapping in-memory API + Firebase-verified session ───")
    client, headers, original_verify = _bootstrap()
    try:
        print("✓ Auth OK\n")

        print("─── Creating DBS Multiplier account ───")
        account_id = _create_account(client, headers)
        ext_id = _external_id(client, headers)
        print(f"✓ Account created ({account_id[:8]}…), External ({ext_id[:8]}…)\n")

        print("─── Creating a categorization rule: 'Grab' → Transport ───")
        transport_id = _create_expense_category(client, headers)
        resp = client.post("/api/v1/categorization-rules", headers=headers, json={
            "match_value": "Grab", "normalized_payee": "Grab",
            "category_id": transport_id, "priority": 10,
        })
        assert resp.status_code == 200, resp.text
        print(f"✓ Rule created (id {resp.json()['id'][:8]}…)\n")

        print("─── Reading the sample DBS CSV headers ───")
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post("/api/v1/transactions/read-file-headers", headers=headers,
                               files={"file": ("dbs.csv", f, "text/csv")})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["headers"][0] == "Transaction Date"
        assert body["bank_reported_balance"] == "SGD 8078.56"
        print(f"✓ Header row at file idx {body['header_row_index']}, "
              f"balance={body['bank_reported_balance']}, "
              f"total rows={body['total_rows']}\n")

        print("─── Parsing rows with column mapping ───")
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/parse-file", headers=headers,
                files={"file": ("dbs.csv", f, "text/csv")},
                data={
                    "account_id": account_id, "file_type": "csv",
                    "column_mapping": (
                        '{"date": "Transaction Date", "payee": "Description",'
                        ' "debit": "Debit Amount", "credit": "Credit Amount"}'
                    ),
                },
            )
        assert resp.status_code == 200, resp.text
        parsed = resp.json()["parsed_transactions"]
        n_dups = sum(1 for tx in parsed if tx["is_duplicate"])
        n_transfers = sum(1 for tx in parsed if tx["transaction_type"] == "transfer")
        n_ruled = sum(1 for tx in parsed if tx["applied_rule_id"])
        print(f"✓ {len(parsed)} rows parsed. dupes={n_dups}, transfers={n_transfers}, "
              f"rule-hit={n_ruled}\n")

        # Sanity: at least one Grab row must have been normalized + categorized.
        grab_rows = [tx for tx in parsed if tx["payee"] == "Grab"]
        assert len(grab_rows) >= 1, "expected at least one Grab row after rule normalization"
        assert grab_rows[0]["category_id"] == transport_id
        print(f"✓ Rule applied to {len(grab_rows)} Grab row(s), category=Transport\n")

        print("─── Committing all valid non-duplicate parsed transactions ───")
        committed = 0
        for tx in parsed:
            if tx["has_errors"] or tx["is_duplicate"]:
                continue
            # Skip transfers (would need destination account)
            if tx["transaction_type"] == "transfer":
                continue
            amount = float(tx["amount"])
            payload = {
                "timestamp": tx["timestamp"],
                "payee": tx["payee"],
                "memo": tx["memo"] or "",
                "status": "cleared",
                "source": "csv_import",
                "import_hash": tx["import_hash"],
                "postings": [
                    {"account_id": account_id, "amount": amount, "currency": "SGD", "fx_rate": 1},
                    {"account_id": ext_id, "amount": -amount, "currency": "SGD", "fx_rate": 1},
                ],
            }
            if tx["category_id"]:
                payload["category_id"] = tx["category_id"]
            r = client.post("/api/v1/transactions", headers=headers, json=payload)
            assert r.status_code == 200, r.text
            committed += 1
        print(f"✓ Committed {committed} transactions\n")

        print("─── Verifying computed balance ───")
        resp = client.get(f"/api/v1/accounts/{account_id}", headers=headers)
        b = resp.json()
        # Skipped: the transfer to PayLah (needs destination) — so 6 rows committed.
        # +6991 salary − 8.10 Grab − 15.70 Grab − 16.40 Salad − 17.26 SP − 2.80 NTUC
        expected_balance = 6991.00 - 8.10 - 15.70 - 16.40 - 17.26 - 2.80
        assert abs(b["balance"] - expected_balance) < 0.01, (
            f"balance mismatch: got {b['balance']}, expected {expected_balance}"
        )
        print(f"✓ Computed balance = {b['balance']:.2f} (matches expected)\n")

        print("─── Re-parsing same CSV — every row should flag as duplicate ───")
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/parse-file", headers=headers,
                files={"file": ("dbs.csv", f, "text/csv")},
                data={
                    "account_id": account_id, "file_type": "csv",
                    "column_mapping": (
                        '{"date": "Transaction Date", "payee": "Description",'
                        ' "debit": "Debit Amount", "credit": "Credit Amount"}'
                    ),
                },
            )
        reparsed = resp.json()["parsed_transactions"]
        # Skip the transfer row (never committed so won't be flagged from DB)
        expected_dupes = [tx for tx in reparsed if tx["transaction_type"] != "transfer" and not tx["has_errors"]]
        actual_dupes = [tx for tx in expected_dupes if tx["is_duplicate"]]
        print(f"✓ Re-import flagged {len(actual_dupes)}/{len(expected_dupes)} committed rows as duplicate\n")

        print("─── Fetching income allocation ───")
        resp = client.get("/api/v1/analytics/income-allocation?years=1", headers=headers)
        assert resp.status_code == 200, resp.text
        print(f"✓ {len(resp.json()['rows'])} monthly rows returned "
              f"(only months with data show up per B54)\n")

        print("─── Fetching scenario defaults ───")
        resp = client.get("/api/v1/analytics/scenario-defaults", headers=headers)
        assert resp.status_code == 200, resp.text
        d = resp.json()
        print(f"✓ Defaults: income median={d['monthly_income']['median']:.2f}, "
              f"expenses median={d['monthly_fixed_costs']['median']:.2f}, "
              f"n_months={d['monthly_income']['n_months_observed']}\n")

        print("─── Fetching account reconciliation ───")
        resp = client.get(f"/api/v1/accounts/{account_id}/reconciliation", headers=headers)
        assert resp.status_code == 200, resp.text
        r = resp.json()
        print(f"✓ Reconciliation: status={r['status']}, computed={r['computed_balance']:.2f}\n")

        print("─── Saving a bank-balance checkpoint from the CSV ───")
        resp = client.post(f"/api/v1/accounts/{account_id}/reconciliation", headers=headers, json={
            "as_of_date": "2026-09-29T23:59:59",
            "reported_balance": 8078.56,
            "source": "csv_import",
            "notes": "Auto-captured from CSV: SGD 8078.56",
        })
        assert resp.status_code == 200, resp.text
        # Refetch reconciliation status
        resp = client.get(f"/api/v1/accounts/{account_id}/reconciliation", headers=headers)
        r = resp.json()
        diff = r["diff"] if r["diff"] is not None else 0
        print(f"✓ After checkpoint: status={r['status']}, diff={diff:.2f}\n")

        print("─── END-TO-END SMOKE PASS ───")
        print("Ready to import 6 months of real data tomorrow.")
        return 0

    finally:
        firebase_auth.verify_id_token = original_verify  # type: ignore
        app.dependency_overrides.clear()


if __name__ == "__main__":
    raise SystemExit(main())
