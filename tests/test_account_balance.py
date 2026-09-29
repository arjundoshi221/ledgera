"""Account balance + reconciliation tests (B55).

Layer 1: `balance` returned by every account read endpoint is
`starting_balance + sum(postings)` — not just `starting_balance` verbatim.
Pre-B55 an account with 422 imported transactions still reported
balance = starting_balance = 0.

Layer 2: PATCH /accounts/{id}/opening-balance sets only the anchor
without requiring the full AccountCreate payload.

Layer 3: POST/GET /accounts/{id}/reconciliation stores bank-reported
balance checkpoints and returns computed-vs-reported diff.
"""

from fastapi.testclient import TestClient

from tests.conftest import firebase_signup


def _num(v) -> float:
    """AccountResponse.balance is Decimal, which Pydantic serializes as a
    string in JSON. Tests want a numeric comparison — coerce here."""
    return float(v) if v is not None else 0.0


def _auth(client: TestClient, firebase_verify, suffix: str) -> tuple[dict, str]:
    data = firebase_signup(
        client, firebase_verify,
        token=f"tok-bal-{suffix}", uid=f"fb-uid-bal-{suffix}",
        email=f"bal-{suffix}@example.com",
    )
    return {"Authorization": f"Bearer {data['access_token']}"}, data["workspace_id"]


def _create_account(
    client: TestClient, headers: dict, name: str = "DBS", starting: str = "0",
) -> str:
    resp = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={
            "name": name, "account_type": "asset", "currency": "SGD",
            "institution": "TestBank", "starting_balance": starting,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def _external_id(client: TestClient, headers: dict) -> str:
    return next(
        a["id"] for a in client.get("/api/v1/accounts", headers=headers).json()
        if a["name"] == "External"
    )


def _post_transaction(
    client: TestClient, headers: dict, *,
    account_id: str, external_id: str, amount: float,
    timestamp: str = "2026-09-15T10:00:00", payee: str = "TestPayee",
) -> None:
    resp = client.post(
        "/api/v1/transactions", headers=headers,
        json={
            "timestamp": timestamp, "payee": payee, "memo": "",
            "status": "cleared", "source": "manual",
            "postings": [
                {"account_id": account_id, "amount": amount, "currency": "SGD", "fx_rate": 1},
                {"account_id": external_id, "amount": -amount, "currency": "SGD", "fx_rate": 1},
            ],
        },
    )
    assert resp.status_code == 200, resp.text


# ─── L1: computed balance ───

class TestComputedBalance:
    def test_empty_account_balance_matches_starting(
        self, client: TestClient, firebase_verify,
    ):
        headers, _ = _auth(client, firebase_verify, "l1-1")
        aid = _create_account(client, headers, starting="0")

        # Freshly created: no postings, balance == starting_balance.
        resp = client.get(f"/api/v1/accounts/{aid}", headers=headers)
        assert resp.json()["balance"] == 0.0
        assert resp.json()["starting_balance"] == 0.0

    def test_balance_reflects_postings(
        self, client: TestClient, firebase_verify,
    ):
        """This is the reported bug: post-import balance != starting_balance."""
        headers, _ = _auth(client, firebase_verify, "l1-2")
        aid = _create_account(client, headers, starting="0")
        ext = _external_id(client, headers)

        _post_transaction(client, headers, account_id=aid, external_id=ext, amount=-8.10)
        _post_transaction(client, headers, account_id=aid, external_id=ext, amount=-15.70)
        _post_transaction(client, headers, account_id=aid, external_id=ext, amount=6991.00)

        # 6991 - 8.10 - 15.70 = 6967.20
        resp = client.get(f"/api/v1/accounts/{aid}", headers=headers)
        body = resp.json()
        assert abs(body["balance"] - 6967.20) < 0.001, f"got {body['balance']}"
        # starting_balance must remain the anchor — not overwritten.
        assert body["starting_balance"] == 0.0

    def test_starting_balance_offsets_postings(
        self, client: TestClient, firebase_verify,
    ):
        """Balance = starting + Σ(postings), not one or the other."""
        headers, _ = _auth(client, firebase_verify, "l1-3")
        aid = _create_account(client, headers, starting="1000")
        ext = _external_id(client, headers)
        _post_transaction(client, headers, account_id=aid, external_id=ext, amount=-100)

        body = client.get(f"/api/v1/accounts/{aid}", headers=headers).json()
        assert body["balance"] == 900.0
        assert body["starting_balance"] == 1000.0

    def test_list_endpoint_uses_batch_query(
        self, client: TestClient, firebase_verify,
    ):
        """The list endpoint must compute balances for every account, not just
        return starting_balance for all."""
        headers, _ = _auth(client, firebase_verify, "l1-4")
        aid1 = _create_account(client, headers, name="Acct1", starting="500")
        aid2 = _create_account(client, headers, name="Acct2", starting="0")
        ext = _external_id(client, headers)

        _post_transaction(client, headers, account_id=aid1, external_id=ext, amount=-50)
        _post_transaction(client, headers, account_id=aid2, external_id=ext, amount=200)

        accounts = client.get("/api/v1/accounts", headers=headers).json()
        by_id = {a["id"]: a for a in accounts}
        assert by_id[aid1]["balance"] == 450.0
        assert by_id[aid2]["balance"] == 200.0

    def test_list_untouched_account_falls_back_cleanly(
        self, client: TestClient, firebase_verify,
    ):
        """An account with no postings appears in the batch result as absent —
        the fallback to starting_balance must not error."""
        headers, _ = _auth(client, firebase_verify, "l1-5")
        aid = _create_account(client, headers, starting="250")

        accounts = client.get("/api/v1/accounts", headers=headers).json()
        row = next(a for a in accounts if a["id"] == aid)
        assert row["balance"] == 250.0


# ─── L2: opening-balance PATCH ───

class TestOpeningBalancePatch:
    def test_patch_sets_starting_only(self, client: TestClient, firebase_verify):
        headers, _ = _auth(client, firebase_verify, "l2-1")
        aid = _create_account(client, headers, starting="0")
        ext = _external_id(client, headers)
        _post_transaction(client, headers, account_id=aid, external_id=ext, amount=-100)

        # Anchor to 5000 — derived e.g. from bank_reported 4900 + 100 spent.
        patch = client.patch(
            f"/api/v1/accounts/{aid}/opening-balance",
            headers=headers,
            json={"starting_balance": "5000"},
        )
        assert patch.status_code == 200, patch.text
        body = patch.json()
        assert body["starting_balance"] == 5000.0
        # Computed balance = 5000 - 100 = 4900.
        assert body["balance"] == 4900.0

    def test_workspace_isolation(self, client: TestClient, firebase_verify):
        h_a, _ = _auth(client, firebase_verify, "l2-a")
        h_b, _ = _auth(client, firebase_verify, "l2-b")
        aid_a = _create_account(client, h_a)

        # B tries to PATCH A's account.
        resp = client.patch(
            f"/api/v1/accounts/{aid_a}/opening-balance",
            headers=h_b,
            json={"starting_balance": "9999"},
        )
        assert resp.status_code == 404


# ─── L3: reconciliation checkpoints ───

class TestReconciliation:
    def test_no_checkpoints_returns_reconciled_null_diff(
        self, client: TestClient, firebase_verify,
    ):
        headers, _ = _auth(client, firebase_verify, "l3-1")
        aid = _create_account(client, headers, starting="100")

        r = client.get(f"/api/v1/accounts/{aid}/reconciliation", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["latest_checkpoint"] is None
        assert body["reported_balance"] is None
        assert body["diff"] is None
        # Never-reconciled is NOT the same as reconciled — distinct state so the
        # UI doesn't paint unverified accounts green.
        assert body["status"] == "never_reconciled"
        assert body["computed_balance"] == 100.0

    def test_checkpoint_matches_ledger(self, client: TestClient, firebase_verify):
        """Import a CSV worth SGD 8078.56, checkpoint at that balance → green."""
        headers, _ = _auth(client, firebase_verify, "l3-2")
        aid = _create_account(client, headers, starting="0")
        ext = _external_id(client, headers)

        _post_transaction(
            client, headers, account_id=aid, external_id=ext,
            amount=8078.56, timestamp="2026-09-29T00:00:00",
        )

        client.post(
            f"/api/v1/accounts/{aid}/reconciliation", headers=headers,
            json={
                "as_of_date": "2026-09-29T23:59:59",
                "reported_balance": "8078.56",
                "source": "csv_import",
                "notes": "DBS Ledger Balance from CSV import",
            },
        )

        r = client.get(f"/api/v1/accounts/{aid}/reconciliation", headers=headers).json()
        assert r["status"] == "reconciled"
        assert abs(r["diff"]) < 0.01
        assert r["reported_balance"] == 8078.56
        assert r["latest_checkpoint"]["source"] == "csv_import"

    def test_missing_transaction_shows_diff(
        self, client: TestClient, firebase_verify,
    ):
        """If a transaction is missing, computed < reported → red diff."""
        headers, _ = _auth(client, firebase_verify, "l3-3")
        aid = _create_account(client, headers, starting="0")
        ext = _external_id(client, headers)
        _post_transaction(
            client, headers, account_id=aid, external_id=ext,
            amount=100.00, timestamp="2026-09-15T10:00:00",
        )
        # Bank says 150, we computed 100 → 50 missing somewhere.
        client.post(
            f"/api/v1/accounts/{aid}/reconciliation", headers=headers,
            json={
                "as_of_date": "2026-09-15T23:59:59",
                "reported_balance": "150.00",
                "source": "manual",
            },
        )
        r = client.get(f"/api/v1/accounts/{aid}/reconciliation", headers=headers).json()
        assert r["status"] == "drifted"
        assert abs(r["diff"] - (-50.0)) < 0.001  # computed - reported = -50

    def test_reconciliation_respects_as_of_date(
        self, client: TestClient, firebase_verify,
    ):
        """Post-checkpoint transactions must NOT enter the computed balance at
        the checkpoint's as_of_date — otherwise every subsequent tx makes a
        previously-reconciled account look drifted."""
        headers, _ = _auth(client, firebase_verify, "l3-4")
        aid = _create_account(client, headers, starting="0")
        ext = _external_id(client, headers)

        # September: post +100. Checkpoint says 100.
        _post_transaction(
            client, headers, account_id=aid, external_id=ext,
            amount=100.00, timestamp="2026-09-15T10:00:00",
        )
        client.post(
            f"/api/v1/accounts/{aid}/reconciliation", headers=headers,
            json={
                "as_of_date": "2026-09-16T00:00:00",
                "reported_balance": "100.00",
                "source": "manual",
            },
        )
        # October: post another +50. Balance today = 150.
        _post_transaction(
            client, headers, account_id=aid, external_id=ext,
            amount=50.00, timestamp="2026-10-15T10:00:00", payee="OctPayee",
        )

        r = client.get(f"/api/v1/accounts/{aid}/reconciliation", headers=headers).json()
        # At the checkpoint's as_of_date, computed was 100 → still reconciled.
        assert r["status"] == "reconciled"
        assert r["computed_balance"] == 100.0

    def test_workspace_isolation(self, client: TestClient, firebase_verify):
        h_a, _ = _auth(client, firebase_verify, "l3-iso-a")
        h_b, _ = _auth(client, firebase_verify, "l3-iso-b")
        aid_a = _create_account(client, h_a)

        # B tries to check A's reconciliation.
        r = client.get(f"/api/v1/accounts/{aid_a}/reconciliation", headers=h_b)
        assert r.status_code == 404

    def test_tz_aware_checkpoint_survives_read(
        self, client: TestClient, firebase_verify,
    ):
        """Frontend sends `new Date().toISOString()` which is tz-aware (`...Z`).
        DB columns are naive UTC. Mixing them raises TypeError on comparisons —
        SQLite hides the bug but Postgres/prod would break. Route must strip tz
        on write; repo must coerce on read."""
        headers, _ = _auth(client, firebase_verify, "l3-tz")
        aid = _create_account(client, headers, starting="0")
        ext = _external_id(client, headers)
        _post_transaction(
            client, headers, account_id=aid, external_id=ext,
            amount=42.00, timestamp="2026-09-15T10:00:00",
        )
        # Note the trailing Z — a tz-aware ISO datetime like the frontend sends.
        resp = client.post(
            f"/api/v1/accounts/{aid}/reconciliation", headers=headers,
            json={
                "as_of_date": "2026-09-15T23:59:59Z",
                "reported_balance": "42.00",
                "source": "csv_import",
            },
        )
        assert resp.status_code == 200, resp.text
        # And a read must not raise TypeError.
        r = client.get(f"/api/v1/accounts/{aid}/reconciliation", headers=headers).json()
        assert r["status"] == "reconciled"


class TestBalanceWorkspaceScoping:
    def test_compute_balance_does_not_leak_cross_workspace_posting(
        self, client: TestClient, firebase_verify,
    ):
        """Defense-in-depth: even if a stray posting existed on this account
        with a transaction whose workspace_id differs, compute_balance must
        filter it out. UUIDs make this near-impossible in practice, but the
        aggregate query should be scoped anyway."""
        h_a, _ = _auth(client, firebase_verify, "scope-a")
        h_b, _ = _auth(client, firebase_verify, "scope-b")
        aid_a = _create_account(client, h_a)
        ext_a = _external_id(client, h_a)
        _post_transaction(client, h_a, account_id=aid_a, external_id=ext_a, amount=100)

        # Workspace B queries its own list — must not see anything from A.
        b_accounts = client.get("/api/v1/accounts", headers=h_b).json()
        for acct in b_accounts:
            assert acct["balance"] == 0.0, f"cross-workspace leak on {acct['name']}: {acct['balance']}"
