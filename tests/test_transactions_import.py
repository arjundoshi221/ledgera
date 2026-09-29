"""CSV/XLSX bank-statement import tests (B50).

Real bank exports (DBS Multiplier here) prefix the file with a metadata preamble
before the actual column-header row. The importer must:
- auto-detect the header row instead of treating row 0 as headers
- surface any bank-reported balance found in the preamble (for reconciliation, B55)
- keep working on "clean" files where headers are already on row 0
"""

from datetime import datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient

from tests.conftest import firebase_signup

FIXTURES = Path(__file__).parent / "fixtures"
DBS_SAMPLE = FIXTURES / "dbs_multiplier_sample.csv"


def _auth_headers(client: TestClient, firebase_verify) -> tuple[dict, str]:
    """Sign up a test user and return (auth headers, workspace_id)."""
    data = firebase_signup(
        client, firebase_verify,
        token="tok-import", uid="fb-uid-import", email="import@example.com",
    )
    return {"Authorization": f"Bearer {data['access_token']}"}, data["workspace_id"]


def _create_account(client: TestClient, headers: dict, name: str = "DBS Multiplier") -> str:
    resp = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={
            "name": name,
            "account_type": "asset",
            "currency": "SGD",
            "institution": "DBS",
            "starting_balance": "0",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


class TestReadFileHeaders:
    """`/transactions/read-file-headers` on a DBS-format CSV."""

    def test_detects_header_row_past_preamble(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/read-file-headers",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
            )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        # Real DBS header columns — not "Account Details For:" etc.
        assert body["headers"] == [
            "Transaction Date", "Value Date", "Statement Code", "Description",
            "Supplementary Code", "Supplementary Code Description",
            "Client Reference", "Additional Reference", "Status", "Currency",
            "Debit Amount", "Credit Amount",
        ]
        # Header lives on file row 8 (0-indexed) in this fixture.
        assert body["header_row_index"] == 8

    def test_captures_bank_reported_balance(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/read-file-headers",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
            )
        body = resp.json()
        # Ledger balance is preferred over available balance (posted > pending).
        assert body["bank_reported_balance"] == "SGD 8078.56"

    def test_auto_suggests_dbs_column_mapping(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/read-file-headers",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
            )
        mapping = resp.json()["suggested_mapping"]
        assert mapping.get("date") == "Transaction Date"
        assert mapping.get("payee") == "Description"
        assert mapping.get("debit") == "Debit Amount"
        assert mapping.get("credit") == "Credit Amount"

    def test_total_rows_excludes_preamble(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/read-file-headers",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
            )
        # Fixture has exactly 7 transaction rows.
        assert resp.json()["total_rows"] == 7

    def test_preview_shows_real_transactions(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/read-file-headers",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
            )
        preview = resp.json()["preview_rows"]
        assert len(preview) >= 5
        # First preview row must be a real transaction, not preamble.
        assert preview[0]["Transaction Date"] == "28 Sep 2026"
        assert "Grab" in preview[0]["Description"]

    def test_clean_csv_without_preamble_still_works(self, client: TestClient, firebase_verify):
        """Regression: CSV whose headers are already on row 0 must parse unchanged."""
        headers_auth, _ = _auth_headers(client, firebase_verify)
        clean = (
            b"Date,Description,Amount\n"
            b"2026-01-15,Groceries,-42.50\n"
            b"2026-01-16,Salary,3000.00\n"
        )
        resp = client.post(
            "/api/v1/transactions/read-file-headers",
            headers=headers_auth,
            files={"file": ("clean.csv", BytesIO(clean), "text/csv")},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["headers"] == ["Date", "Description", "Amount"]
        assert body["header_row_index"] == 0
        assert body["bank_reported_balance"] is None
        assert body["total_rows"] == 2


class TestParseFile:
    """`/transactions/parse-file` end-to-end with a DBS-format CSV."""

    def test_parses_all_transactions_without_leaking_preamble(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers_auth)

        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/parse-file",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
                data={
                    "account_id": account_id,
                    "file_type": "csv",
                    "column_mapping": (
                        '{"date": "Transaction Date", "payee": "Description",'
                        ' "debit": "Debit Amount", "credit": "Credit Amount"}'
                    ),
                },
            )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert body["total_rows"] == 7
        parsed = body["parsed_transactions"]
        assert len(parsed) == 7

        # Every row must have a valid parsed date — a preamble leak would fail.
        for tx in parsed:
            assert tx["timestamp"] is not None, f"row {tx['row_number']} failed to parse date: {tx}"
            assert not tx["has_errors"], f"row {tx['row_number']} had errors: {tx['warnings']}"

    def test_salary_row_is_income(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers_auth)

        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/parse-file",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
                data={
                    "account_id": account_id,
                    "file_type": "csv",
                    "column_mapping": (
                        '{"date": "Transaction Date", "payee": "Description",'
                        ' "debit": "Debit Amount", "credit": "Credit Amount"}'
                    ),
                },
            )
        parsed = resp.json()["parsed_transactions"]
        salary = next(tx for tx in parsed if "EXAMPLE EMPLOYER" in tx["payee"])
        assert salary["transaction_type"] == "income"
        assert float(salary["amount"]) == 6991.00

    def test_expense_row_has_negative_amount(self, client: TestClient, firebase_verify):
        headers_auth, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers_auth)

        with DBS_SAMPLE.open("rb") as f:
            resp = client.post(
                "/api/v1/transactions/parse-file",
                headers=headers_auth,
                files={"file": ("dbs.csv", f, "text/csv")},
                data={
                    "account_id": account_id,
                    "file_type": "csv",
                    "column_mapping": (
                        '{"date": "Transaction Date", "payee": "Description",'
                        ' "debit": "Debit Amount", "credit": "Credit Amount"}'
                    ),
                },
            )
        parsed = resp.json()["parsed_transactions"]
        grab = next(tx for tx in parsed if "Grab" in tx["payee"] and "AAA111" in tx["payee"])
        assert grab["transaction_type"] == "expense"
        assert float(grab["amount"]) == -8.10


# ─── B51: duplicate detection ───

DBS_MAPPING = (
    '{"date": "Transaction Date", "payee": "Description",'
    ' "debit": "Debit Amount", "credit": "Credit Amount"}'
)


def _parse_sample(client: TestClient, headers: dict, account_id: str) -> list[dict]:
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


def _external_account_id(client: TestClient, headers: dict) -> str:
    resp = client.get("/api/v1/accounts", headers=headers)
    return next(a["id"] for a in resp.json() if a["name"] == "External")


def _commit_parsed(
    client: TestClient, headers: dict, parsed_tx: dict,
    account_id: str, external_id: str,
) -> None:
    """Turn a parsed row into a real transaction via POST /transactions."""
    amount = float(parsed_tx["amount"])
    resp = client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "timestamp": parsed_tx["timestamp"],
            "payee": parsed_tx["payee"],
            "memo": parsed_tx["memo"] or "",
            "status": "cleared",
            "source": "csv_import",
            "import_hash": parsed_tx["import_hash"],
            "postings": [
                {"account_id": account_id, "amount": amount, "currency": "SGD", "fx_rate": 1},
                {"account_id": external_id, "amount": -amount, "currency": "SGD", "fx_rate": 1},
            ],
        },
    )
    assert resp.status_code == 200, resp.text


class TestImportDedup:
    """B51: re-importing an overlapping CSV must not double-book anything."""

    def test_first_import_marks_no_duplicates(self, client: TestClient, firebase_verify):
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)

        parsed = _parse_sample(client, headers, account_id)

        # No transactions exist yet — nothing can be a duplicate.
        for tx in parsed:
            assert tx["is_duplicate"] is False, f"row {tx['row_number']} flagged as dup on empty workspace"
            assert tx["import_hash"] is not None
            assert len(tx["import_hash"]) == 64  # SHA-256 hex

    def test_second_import_flags_every_row_as_duplicate(self, client: TestClient, firebase_verify):
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)
        external_id = _external_account_id(client, headers)

        # First import — commit each valid row.
        first = _parse_sample(client, headers, account_id)
        for tx in first:
            if tx["has_errors"]:
                continue
            _commit_parsed(client, headers, tx, account_id, external_id)

        # Second parse — every row should now flag as duplicate against the DB.
        second = _parse_sample(client, headers, account_id)
        valid_rows = [tx for tx in second if not tx["has_errors"]]
        assert len(valid_rows) > 0
        for tx in valid_rows:
            assert tx["is_duplicate"] is True, (
                f"row {tx['row_number']} not flagged as duplicate after re-import: {tx['payee']}"
            )
            assert tx["existing_transaction_id"] is not None

    def test_manual_transaction_is_detected_by_subsequent_import(
        self, client: TestClient, firebase_verify,
    ):
        """A user manually enters a row, then imports a CSV containing the same row —
        the parse response must flag the manually-entered row as a duplicate."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)
        external_id = _external_account_id(client, headers)

        # Parse once just to grab a real row + its computed fingerprint.
        parsed = _parse_sample(client, headers, account_id)
        target = next(tx for tx in parsed if "Grab" in tx["payee"] and "AAA111" in tx["payee"])

        # Commit it via the manual path — we still pass the fingerprint so it stores.
        _commit_parsed(client, headers, target, account_id, external_id)

        # Now re-parse. That specific row should be flagged; other rows shouldn't be.
        reparsed = _parse_sample(client, headers, account_id)
        target_reparsed = next(
            tx for tx in reparsed if tx["row_number"] == target["row_number"]
        )
        assert target_reparsed["is_duplicate"] is True
        assert target_reparsed["existing_transaction_id"] is not None

        # Every other row should still be non-duplicate.
        others = [tx for tx in reparsed if tx["row_number"] != target["row_number"] and not tx["has_errors"]]
        assert all(tx["is_duplicate"] is False for tx in others)

    def test_partial_overlap_only_flags_overlapping_rows(
        self, client: TestClient, firebase_verify,
    ):
        """Import file A (some rows), then file B (which shares half its rows with A):
        only the overlapping rows should be flagged in the second parse."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)
        external_id = _external_account_id(client, headers)

        parsed_first = _parse_sample(client, headers, account_id)
        valid = [tx for tx in parsed_first if not tx["has_errors"]]
        # Commit only the first half of the file.
        for tx in valid[: len(valid) // 2]:
            _commit_parsed(client, headers, tx, account_id, external_id)

        # Re-parse the whole file. Committed rows should flag; uncommitted shouldn't.
        parsed_second = _parse_sample(client, headers, account_id)
        committed_hashes = {tx["import_hash"] for tx in valid[: len(valid) // 2]}
        for tx in parsed_second:
            if tx["has_errors"]:
                continue
            expected_dup = tx["import_hash"] in committed_hashes
            assert tx["is_duplicate"] is expected_dup, (
                f"row {tx['row_number']} ({tx['payee']!r}) dup mismatch: "
                f"expected={expected_dup}, got={tx['is_duplicate']}"
            )

    def test_normalized_payee_survives_bank_rewrites(
        self, client: TestClient, firebase_verify,
    ):
        """DBS re-exports the same transaction with a stable alphanumeric merchant
        ID but a re-generated numeric reference at the tail (the '00000...' code).
        Payee normalization must strip the volatile digits so the fingerprint is
        stable across exports."""
        from src.api.routes.transactions import _compute_import_fingerprint

        ts = datetime(2026, 9, 28, 12, 0, 0)
        fp_a = _compute_import_fingerprint(
            "ws-1", "acct-1", ts, Decimal("-8.10"),
            "BAT Grab* A-9SJ45PDWW3OAAV Si SGP 25SEP 4628-4502-2367-6322 000003154583254",
        )
        fp_b = _compute_import_fingerprint(
            "ws-1", "acct-1", ts, Decimal("-8.10"),
            "BAT Grab* A-9SJ45PDWW3OAAV Si SGP 25SEP 4628-4502-2367-6322 000009999999999",
        )
        assert fp_a == fp_b, (
            "Payee normalization must strip transaction IDs / card tails so re-exports "
            "of the same underlying transaction match."
        )

    def test_legitimate_identical_rows_collide_and_require_override(
        self, client: TestClient, firebase_verify,
    ):
        """Two legitimate identical charges (e.g. two $3.20 MRT trips same day)
        share a fingerprint. The second occurrence in a single file is flagged
        as a duplicate with `existing_transaction_id = None` so the frontend
        renders "Duplicate in file" rather than "Duplicate of existing". The
        user must explicitly click "Import anyway" to commit it — this is the
        intended trade-off, not a bug."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)

        # Craft a 3-row CSV with two identical rows plus a distinct one.
        csv = (
            b"Date,Description,Debit Amount,Credit Amount\n"
            b"2026-09-01,BAT BUS/MRT SGP 01SEP,3.20,\n"
            b"2026-09-01,BAT BUS/MRT SGP 01SEP,3.20,\n"
            b"2026-09-01,BAT Salad Stop SGP 01SEP,16.40,\n"
        )
        resp = client.post(
            "/api/v1/transactions/parse-file",
            headers=headers,
            files={"file": ("t.csv", BytesIO(csv), "text/csv")},
            data={
                "account_id": account_id,
                "file_type": "csv",
                "column_mapping": (
                    '{"date": "Date", "payee": "Description",'
                    ' "debit": "Debit Amount", "credit": "Credit Amount"}'
                ),
            },
        )
        assert resp.status_code == 200, resp.text
        parsed = resp.json()["parsed_transactions"]
        mrt_rows = [tx for tx in parsed if "BUS/MRT" in tx["payee"]]
        salad_rows = [tx for tx in parsed if "Salad" in tx["payee"]]

        assert len(mrt_rows) == 2
        assert mrt_rows[0]["is_duplicate"] is False, "first occurrence must not be flagged"
        assert mrt_rows[1]["is_duplicate"] is True, "second occurrence must be flagged"
        assert mrt_rows[1]["existing_transaction_id"] is None, (
            "same-file duplicate must NOT reference an existing transaction — "
            "that distinction drives the frontend's 'Duplicate in file' vs "
            "'Duplicate of existing' badge copy."
        )
        # Sanity: the unrelated row is untouched.
        assert len(salad_rows) == 1
        assert salad_rows[0]["is_duplicate"] is False

    def test_reparse_without_commit_does_not_carry_state(
        self, client: TestClient, firebase_verify,
    ):
        """Parsing the same file twice back-to-back without committing any rows
        must produce the same output. `seen_in_file` is scoped per request; the
        DB pre-fetch is empty both times."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)

        first = _parse_sample(client, headers, account_id)
        second = _parse_sample(client, headers, account_id)

        assert len(first) == len(second)
        for a, b in zip(first, second):
            assert a["is_duplicate"] == b["is_duplicate"], (
                f"row {a['row_number']} dup flag changed between identical parse calls"
            )
            assert a["import_hash"] == b["import_hash"]

    def test_paylah_topup_classified_as_transfer(
        self, client: TestClient, firebase_verify,
    ):
        """PayLah top-up rows are own-account transfers — must NOT count as expense
        (would double-book the money once at top-up and again when PayLah pays a
        merchant)."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)

        parsed = _parse_sample(client, headers, account_id)
        paylah = next(tx for tx in parsed if "PAYLAH" in tx["payee"].upper())
        assert paylah["transaction_type"] == "transfer"
        assert paylah["pending_transfer_destination"] is True, (
            "transfer rows must flag pending_transfer_destination so the frontend "
            "blocks commit until the user picks a destination account"
        )

    def test_paynow_to_utility_stays_expense(
        self, client: TestClient, firebase_verify,
    ):
        """`ICT PayNow Transfer To: SP SERVICES LTD` is a bill payment, not an
        own-account transfer. Must stay classified as expense (user overrides in
        UI if wrong)."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)

        parsed = _parse_sample(client, headers, account_id)
        sp = next(tx for tx in parsed if "SP SERVICES" in tx["payee"].upper())
        assert sp["transaction_type"] == "expense"
        assert sp["pending_transfer_destination"] is False

    def test_salary_still_income(self, client: TestClient, firebase_verify):
        """Regression: adding transfer classification must not break income detection."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)

        parsed = _parse_sample(client, headers, account_id)
        salary = next(tx for tx in parsed if "EXAMPLE EMPLOYER" in tx["payee"].upper())
        assert salary["transaction_type"] == "income"
        assert salary["pending_transfer_destination"] is False

    def test_ordinary_pos_still_expense(self, client: TestClient, firebase_verify):
        """Regression: adding transfer classification must not accidentally sweep
        all debits into transfer just because they share substrings."""
        headers, _ = _auth_headers(client, firebase_verify)
        account_id = _create_account(client, headers)

        parsed = _parse_sample(client, headers, account_id)
        grab = next(tx for tx in parsed if "AAA111" in tx["payee"])
        assert grab["transaction_type"] == "expense"
        assert grab["pending_transfer_destination"] is False

    def test_classify_row_unit_credit_card_payment(self):
        """Unit-level: paying off own credit card is a transfer."""
        from src.api.routes.transactions import _classify_row
        assert _classify_row("CARD PAYMENT UOB ONE", None, Decimal("-500")) == "transfer"
        assert _classify_row("DBS CREDIT CARD PMT", None, Decimal("-1200")) == "transfer"

    def test_classify_row_unit_ambiguous_stays_default(self):
        """Unit-level: rows that don't match a high-confidence pattern fall back
        to the sign-based rule."""
        from src.api.routes.transactions import _classify_row
        # 'PAYNOW TRANSFER' alone is not high-confidence — could be a bill payment.
        assert _classify_row("ICT PayNow Transfer 000 To: SP SERVICES", None, Decimal("-17")) == "expense"
        # Salary
        assert _classify_row("PAY ACME CORP Sep 2026 Salary", None, Decimal("6991")) == "income"
        # Random POS
        assert _classify_row("BAT NTUC FairPrice", None, Decimal("-2.80")) == "expense"

    def test_different_merchants_do_not_collide(self):
        """Sanity: different merchants must produce different fingerprints even if
        the numeric tail bytes are identical."""
        from src.api.routes.transactions import _compute_import_fingerprint

        ts = datetime(2026, 9, 28, 12, 0, 0)
        fp_grab = _compute_import_fingerprint(
            "ws-1", "acct-1", ts, Decimal("-8.10"),
            "BAT Grab* Si SGP 25SEP 000003154583254",
        )
        fp_salad = _compute_import_fingerprint(
            "ws-1", "acct-1", ts, Decimal("-8.10"),
            "BAT Salad Stop Pte Ltd Si SGP 25SEP 000003154583254",
        )
        assert fp_grab != fp_salad

    def test_different_amounts_do_not_collide(self):
        """Same everything except amount → distinct fingerprints (sanity)."""
        from src.api.routes.transactions import _compute_import_fingerprint

        ts = datetime(2026, 9, 28, 12, 0, 0)
        fp_a = _compute_import_fingerprint("ws-1", "acct-1", ts, Decimal("-8.10"), "Grab")
        fp_b = _compute_import_fingerprint("ws-1", "acct-1", ts, Decimal("-8.20"), "Grab")
        assert fp_a != fp_b
