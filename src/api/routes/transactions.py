"""Transaction endpoints"""

import hashlib
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from dateutil import parser as date_parser

# pandas is imported lazily inside the two file-upload handlers below.
# Cold-import of pandas is 1.5-2s; deferring it keeps FastAPI startup fast
# (see B4). Do NOT reintroduce a module-level `import pandas as pd`.
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from src.api.deps import get_workspace_id
from src.api.errors import NotFound
from src.api.schemas import (
    FileHeadersResponse,
    FileParseResult,
    ParsedTransaction,
    TransactionCreate,
    TransferCreate,
)
from src.data.database import get_session
from src.data.models import (
    AccountModel,
    CategoryModel,
    FundAccountLinkModel,
    FundModel,
    PostingModel,
    TransactionModel,
)
from src.data.repositories import AccountRepository, TransactionRepository

router = APIRouter()


@router.get("")
def get_all_transactions(
    workspace_id: str = Depends(get_workspace_id),
    start_date: datetime = None,
    end_date: datetime = None,
    session: Session = Depends(get_session)
):
    """Get all transactions for the workspace (no duplicates)"""
    query = session.query(TransactionModel).filter(
        TransactionModel.workspace_id == workspace_id
    )

    if start_date:
        query = query.filter(TransactionModel.timestamp >= start_date)
    if end_date:
        query = query.filter(TransactionModel.timestamp <= end_date)

    txs = query.order_by(TransactionModel.timestamp.desc()).all()

    return [_serialize_tx(tx) for tx in txs]


def _serialize_tx(tx: TransactionModel) -> dict:
    """Serialize a transaction with its postings."""
    return {
        "id": tx.id,
        "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
        "payee": tx.payee,
        "memo": tx.memo,
        "status": tx.status,
        "type": tx.type,
        "category_id": tx.category_id,
        "subcategory_id": tx.subcategory_id,
        "fund_id": tx.fund_id,
        "source_fund_id": tx.source_fund_id,
        "dest_fund_id": tx.dest_fund_id,
        "payment_method_id": tx.payment_method_id,
        "postings": [
            {
                "account_id": p.account_id,
                "amount": float(p.amount),
                "currency": p.posting_currency,
                "fx_rate": float(p.fx_rate_to_base),
            }
            for p in tx.postings
        ],
    }


@router.post("")
def create_transaction(
    tx: TransactionCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a new transaction with double-entry postings"""
    account_repo = AccountRepository(session)

    # Verify all accounts exist and belong to this workspace
    for posting in tx.postings:
        account = account_repo.read_for_workspace(str(posting.account_id), workspace_id)
        if not account:
            raise NotFound(
                f"Account {posting.account_id} not found in workspace",
                account_id=str(posting.account_id),
            )

    # Create transaction
    db_tx = TransactionModel(
        workspace_id=workspace_id,
        timestamp=tx.timestamp,
        payee=tx.payee,
        memo=tx.memo,
        status=tx.status,
        source=tx.source,
        category_id=tx.category_id,
        subcategory_id=tx.subcategory_id,
        fund_id=tx.fund_id,
        payment_method_id=tx.payment_method_id,
        import_hash=tx.import_hash,  # B51: persisted for future dedup checks
    )

    # Create postings
    for posting in tx.postings:
        db_posting = PostingModel(
            account_id=str(posting.account_id),
            amount=posting.amount,
            posting_currency=posting.currency,
            base_amount=posting.amount,  # MVP: assume base currency = posting currency
            fx_rate_to_base=posting.fx_rate
        )
        db_tx.postings.append(db_posting)

    # Validate balanced
    total_base = sum(float(p.base_amount) for p in db_tx.postings)
    if abs(total_base) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction not balanced: {total_base}"
        )

    # Save
    repo = TransactionRepository(session)
    repo.create(db_tx)

    return _serialize_tx(db_tx)


def _auto_detect_fund(session: Session, account_id: str, workspace_id: str) -> str | None:
    """If an account is linked to exactly one active fund, return that fund_id."""
    links = session.query(FundAccountLinkModel).join(
        FundModel, FundAccountLinkModel.fund_id == FundModel.id
    ).filter(
        FundAccountLinkModel.account_id == account_id,
        FundModel.workspace_id == workspace_id,
        FundModel.is_active.is_(True)
    ).all()

    if len(links) == 1:
        return links[0].fund_id
    return None


@router.post("/transfer")
def create_transfer(
    transfer: TransferCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Create a transfer transaction between two accounts with fund tracking"""
    account_repo = AccountRepository(session)

    # Validate accounts exist in workspace
    from_account = account_repo.read_for_workspace(transfer.from_account_id, workspace_id)
    if not from_account:
        raise NotFound(
            f"From account {transfer.from_account_id} not found",
            account_id=transfer.from_account_id,
        )

    to_account = account_repo.read_for_workspace(transfer.to_account_id, workspace_id)
    if not to_account:
        raise NotFound(
            f"To account {transfer.to_account_id} not found",
            account_id=transfer.to_account_id,
        )

    if transfer.from_account_id == transfer.to_account_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    if transfer.amount <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be positive")

    # Auto-detect funds from account links if not provided
    source_fund_id = transfer.source_fund_id or _auto_detect_fund(session, transfer.from_account_id, workspace_id)
    dest_fund_id = transfer.dest_fund_id or _auto_detect_fund(session, transfer.to_account_id, workspace_id)

    # Currency handling
    to_currency = transfer.to_currency or transfer.from_currency
    fx_rate = transfer.fx_rate
    received_amount = transfer.amount * fx_rate

    # Create transaction
    db_tx = TransactionModel(
        workspace_id=workspace_id,
        timestamp=transfer.timestamp,
        payee=transfer.payee,
        memo=transfer.memo,
        status="unreconciled",
        source="manual",
        type="transfer",
        fund_id=None,
        source_fund_id=source_fund_id,
        dest_fund_id=dest_fund_id,
        category_id=None,
        subcategory_id=None,
        payment_method_id=transfer.payment_method_id,
    )

    # From-posting: money leaves source account (negative)
    from_posting = PostingModel(
        account_id=transfer.from_account_id,
        amount=-transfer.amount,
        posting_currency=transfer.from_currency,
        fx_rate_to_base=Decimal(1),
        base_amount=-transfer.amount,
    )
    db_tx.postings.append(from_posting)

    # To-posting: money enters dest account (positive)
    to_fx_rate_to_base = Decimal(1) / fx_rate if fx_rate != 0 else Decimal(1)
    to_posting = PostingModel(
        account_id=transfer.to_account_id,
        amount=received_amount,
        posting_currency=to_currency,
        fx_rate_to_base=to_fx_rate_to_base,
        base_amount=transfer.amount,  # In base currency, equals the from amount
    )
    db_tx.postings.append(to_posting)

    # Validate balanced in base currency
    total_base = sum(float(p.base_amount) for p in db_tx.postings)
    if abs(total_base) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transfer not balanced in base currency: {total_base}"
        )

    # Save transfer
    repo = TransactionRepository(session)
    repo.create(db_tx)

    # Create separate fee expense transaction if fee > 0
    fee_tx = None
    if transfer.fee and transfer.fee > 0:
        external_acc = session.query(AccountModel).filter(
            AccountModel.workspace_id == workspace_id,
            AccountModel.name == "External"
        ).first()

        # Auto-resolve fee category: use provided ID, or fall back to system "FX Fees"
        fee_category_id = transfer.fee_category_id
        if not fee_category_id:
            fx_fees_cat = session.query(CategoryModel).filter(
                CategoryModel.workspace_id == workspace_id,
                CategoryModel.name == "FX Fees",
                CategoryModel.is_system.is_(True)
            ).first()
            if fx_fees_cat:
                fee_category_id = fx_fees_cat.id

        if external_acc:
            fee_tx = TransactionModel(
                workspace_id=workspace_id,
                timestamp=transfer.timestamp,
                payee="Transfer Fee",
                memo=f"FX fee for transfer to {to_account.name}" if to_account else "Transfer fee",
                status="unreconciled",
                source="manual",
                type=None,
                fund_id=source_fund_id,
                source_fund_id=None,
                dest_fund_id=None,
                category_id=fee_category_id,
                subcategory_id=None,
            )
            fee_from = PostingModel(
                account_id=transfer.from_account_id,
                amount=-transfer.fee,
                posting_currency=transfer.from_currency,
                fx_rate_to_base=Decimal(1),
                base_amount=-transfer.fee,
            )
            fee_tx.postings.append(fee_from)
            fee_ext = PostingModel(
                account_id=external_acc.id,
                amount=transfer.fee,
                posting_currency=transfer.from_currency,
                fx_rate_to_base=Decimal(1),
                base_amount=transfer.fee,
            )
            fee_tx.postings.append(fee_ext)
            repo.create(fee_tx)

    result = _serialize_tx(db_tx)
    if fee_tx:
        result["fee_transaction"] = _serialize_tx(fee_tx)
    return result


@router.get("/{transaction_id}")
def get_transaction(
    transaction_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Get transaction by ID"""
    repo = TransactionRepository(session)
    tx = repo.read(transaction_id)

    if not tx or tx.workspace_id != workspace_id:
        raise NotFound("Transaction not found", transaction_id=transaction_id)

    return _serialize_tx(tx)


@router.put("/{transaction_id}")
def update_transaction(
    transaction_id: str,
    tx_update: TransactionCreate,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Update an existing transaction"""
    repo = TransactionRepository(session)
    tx = repo.read(transaction_id)

    # Verify transaction exists and belongs to workspace
    if not tx or tx.workspace_id != workspace_id:
        raise NotFound("Transaction not found", transaction_id=transaction_id)

    account_repo = AccountRepository(session)

    # Verify all accounts exist and belong to this workspace
    for posting in tx_update.postings:
        account = account_repo.read_for_workspace(str(posting.account_id), workspace_id)
        if not account:
            raise NotFound(
                f"Account {posting.account_id} not found in workspace",
                account_id=str(posting.account_id),
            )

    # Update transaction fields
    tx.timestamp = tx_update.timestamp
    tx.payee = tx_update.payee
    tx.memo = tx_update.memo
    tx.status = tx_update.status
    tx.category_id = tx_update.category_id
    tx.subcategory_id = tx_update.subcategory_id
    tx.fund_id = tx_update.fund_id
    tx.payment_method_id = tx_update.payment_method_id

    # Delete old postings and create new ones
    tx.postings = []
    session.flush()  # Ensure old postings are deleted

    # Create new postings
    for posting in tx_update.postings:
        db_posting = PostingModel(
            account_id=str(posting.account_id),
            amount=posting.amount,
            posting_currency=posting.currency,
            base_amount=posting.amount,  # MVP: assume base currency = posting currency
            fx_rate_to_base=posting.fx_rate
        )
        tx.postings.append(db_posting)

    # Validate balanced
    total_base = sum(float(p.base_amount) for p in tx.postings)
    if abs(total_base) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Transaction not balanced: {total_base}"
        )

    # Save (update() auto-sets updated_at)
    repo.update(tx)

    return _serialize_tx(tx)


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """Delete a transaction (scoped to workspace)"""
    repo = TransactionRepository(session)
    tx = repo.read(transaction_id)

    if not tx or tx.workspace_id != workspace_id:
        raise NotFound("Transaction not found", transaction_id=transaction_id)

    repo.delete(transaction_id)
    return {"message": "Transaction deleted"}


@router.get("/account/{account_id}")
def get_account_transactions(
    account_id: str,
    workspace_id: str = Depends(get_workspace_id),
    start_date: datetime = None,
    end_date: datetime = None,
    session: Session = Depends(get_session)
):
    """Get transactions for an account"""
    # Verify account belongs to workspace
    account_repo = AccountRepository(session)
    account = account_repo.read_for_workspace(account_id, workspace_id)
    if not account:
        raise NotFound("Account not found", account_id=account_id)

    repo = TransactionRepository(session)
    txs = repo.read_by_account(account_id, start_date, end_date)

    return [_serialize_tx(tx) for tx in txs]


# ─── Row classification helpers (B52) ───

# Bank-statement text patterns that (with high confidence) indicate a transfer
# between the user's own accounts — money moves out of the imported account,
# but not out of their overall net worth. These MUST NOT be counted as expenses
# or cost-tracking overstates spend.
#
# Only high-confidence patterns live here. `ICT PayNow Transfer` is deliberately
# excluded because it's just as often a bill payment (SP Services, IRAS) as a
# self-transfer. Classify those as expense by default; the user overrides in
# the review UI if they mean it as a transfer.
_TRANSFER_HIGH_CONFIDENCE_PATTERNS = (
    "TOP-UP TO PAYLAH",
    "TOP-UP TO GRABPAY",
    "TOP-UP TO SINGTEL DASH",
    "TRF TO SAV",
    "TRF TO CUR",
    "TRF TO MULTIPLIER",
    "TRF TO ESAVINGS",
    "CARD PAYMENT",     # paying off own credit card
    "CREDIT CARD PMT",
    "TRANSFER TO OWN",
)


def _classify_row(payee: str, memo: str | None, amount: Decimal) -> str:
    """Determine the transaction type from parsed row text.

    Returns one of "income", "expense", "transfer". Transfer rows require the
    user to pick a destination account in the review UI before commit — the
    parse step can't know which of the user's accounts is the counterparty.
    """
    text = f"{payee or ''} {memo or ''}".upper()

    if any(p in text for p in _TRANSFER_HIGH_CONFIDENCE_PATTERNS):
        return "transfer"

    return "income" if amount > 0 else "expense"


# ─── Import dedup helpers (B51) ───

# Payee normalization strips volatile bits (transaction IDs, card numbers, dates
# embedded in DBS descriptions) so re-imports of the same underlying transaction
# hash to the same value even if the bank rewrites the tail bytes.
_PAYEE_STRIP_RE = re.compile(r"[\d\-*]+")


def _normalize_payee(payee: str) -> str:
    """Lowercase, strip digits/dashes/asterisks, collapse whitespace."""
    stripped = _PAYEE_STRIP_RE.sub(" ", payee or "")
    return " ".join(stripped.split()).lower()


def _compute_import_fingerprint(
    workspace_id: str, account_id: str,
    timestamp: datetime, amount: Decimal, payee: str,
) -> str:
    """SHA-256 fingerprint for near-duplicate detection at import.

    Keyed by workspace + account + date (day granularity) + amount (quantized to
    2 decimal places) + normalized payee. Deterministic — re-running on the same
    row yields the same hash.

    NOT keyed by memo (bank exports rewrite memos across snapshots) or by
    transaction_id (obviously). Two legitimate identical transactions (e.g. two
    $3.20 MRT trips same day) will collide and get flagged; the user can
    override with "Import anyway."
    """
    normalized_amount = f"{Decimal(amount).quantize(Decimal('0.01')):.2f}"
    key = "|".join([
        workspace_id, account_id,
        timestamp.date().isoformat(),
        normalized_amount,
        _normalize_payee(payee),
    ])
    return hashlib.sha256(key.encode()).hexdigest()


# ─── Bank Statement Import endpoints ───

# Column name patterns for auto-detection (case-insensitive)
DATE_PATTERNS = ["date", "transaction date", "posted date", "value date", "trans date", "posting date"]
PAYEE_PATTERNS = ["description", "payee", "merchant", "particulars", "narration", "details"]
DEBIT_PATTERNS = ["debit", "withdrawal", "dr", "debit amount", "withdrawals"]
CREDIT_PATTERNS = ["credit", "deposit", "cr", "credit amount", "deposits"]
AMOUNT_PATTERNS = ["amount", "value", "transaction amount", "amt"]
MEMO_PATTERNS = ["memo", "reference", "ref", "remarks", "notes", "comment"]

# Keywords that identify a real header row anywhere in the first 30 rows of a file.
# Union of all column-name patterns above plus a few generic bank statement columns.
_HEADER_KEYWORDS = (
    "date", "amount", "debit", "credit", "description", "payee", "memo",
    "reference", "transaction", "particulars", "narration", "details",
    "value", "type", "status", "currency", "balance", "remarks", "posting",
)

# Preamble lines DBS/OCBC/UOB use for the account's current balance.
# Ordered by preference: "ledger" (posted) wins over "available" (may include pending).
_BALANCE_LABEL_KEYWORDS = ("ledger balance", "closing balance", "current balance", "available balance")


def _looks_like_number(s: str) -> bool:
    """Return True if s parses cleanly as a number. Used to reject data rows during header search."""
    s = s.strip().replace(",", "").replace("(", "-").replace(")", "")
    if not s:
        return False
    try:
        float(s)
    except ValueError:
        return False
    return True


def _detect_header_and_balance(df_raw) -> tuple[int, str | None]:
    """Scan a header-less DataFrame for the real header row and any bank-reported balance.

    Bank exports (DBS, OCBC, UOB, etc.) prefix their CSVs with a metadata preamble
    ("Account Details For:", balance lines, blank rows) before the actual column
    header. Naive `pd.read_csv` treats row 0 as the header and mis-parses everything.

    Returns (header_row_idx, bank_reported_balance). If no plausible header is found,
    returns (0, None) so callers get the pre-B50 behavior as a safe fallback.
    """
    import pandas as pd  # lazy: see B4

    # Pass 1: pick the best-looking header row.
    header_idx = 0
    best_score = 0
    for i in range(len(df_raw)):
        row = df_raw.iloc[i]
        cells = [str(c).strip() for c in row if pd.notna(c) and str(c).strip()]
        if len(cells) < 3:
            continue
        # Header rows are all-text — reject the row if any non-empty cell parses as a number.
        if any(_looks_like_number(c) for c in cells):
            continue
        lower_cells = [c.lower() for c in cells]
        score = sum(1 for c in lower_cells if any(k in c for k in _HEADER_KEYWORDS))
        if score > best_score:
            best_score = score
            header_idx = i

    # If nothing scored, keep header_idx=0 (no preamble file — original behavior).

    # Pass 2: scan preamble rows only for a bank-reported balance.
    # Prefer earlier keywords in _BALANCE_LABEL_KEYWORDS (ledger > closing > current > available).
    bank_balance: str | None = None
    best_pref = len(_BALANCE_LABEL_KEYWORDS)  # lower is better
    for i in range(header_idx):
        row = df_raw.iloc[i]
        cells = [str(c).strip() for c in row if pd.notna(c) and str(c).strip()]
        if len(cells) < 2:
            continue
        label = cells[0].lower().rstrip(":").strip()
        for pref_idx, kw in enumerate(_BALANCE_LABEL_KEYWORDS):
            if kw in label and pref_idx < best_pref:
                bank_balance = cells[1]
                best_pref = pref_idx
                break

    return header_idx, bank_balance


def _load_transaction_file(
    content: bytes, file_type: str, sheet_name: str | None = None
) -> tuple["object", int, str | None]:
    """Load a bank statement file, auto-detecting the header row and any bank-reported balance.

    Returns (dataframe, header_row_idx, bank_reported_balance). The dataframe has
    the real header applied, all-empty rows dropped, and rows below the header
    intact. Blank rows in the preamble do not shift indices.
    """
    import pandas as pd  # lazy: see B4

    if file_type == "csv":
        df_raw = pd.read_csv(
            io.BytesIO(content), header=None, nrows=30, dtype=str, skip_blank_lines=False
        )
    elif file_type == "xlsx":
        df_raw = pd.read_excel(
            io.BytesIO(content), sheet_name=sheet_name, header=None, nrows=30, dtype=str,
            engine="openpyxl",
        )
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

    header_idx, bank_balance = _detect_header_and_balance(df_raw)

    # Re-read with the detected header row. skiprows drops preamble; header=0 then
    # takes the first surviving row as the header. skip_blank_lines=False keeps
    # index math predictable; we drop all-NaN rows after the fact.
    if file_type == "csv":
        df = pd.read_csv(
            io.BytesIO(content),
            skiprows=header_idx,
            header=0,
            skip_blank_lines=False,
        )
    else:
        df = pd.read_excel(
            io.BytesIO(content),
            sheet_name=sheet_name,
            skiprows=header_idx,
            header=0,
            engine="openpyxl",
        )

    df = df.dropna(how="all").reset_index(drop=True)
    return df, header_idx, bank_balance


def _matches_pattern(header_lower: str, patterns: list[str]) -> bool:
    """Match a header against any pattern using word-boundary semantics.

    Substring matching gives false positives: `"cr" in "description"` is True,
    causing `Description` to be picked as the credit column. Word-boundary
    matching (via regex `\\b`) treats "cr" as a whole token — matches "Cr"
    or "Credit" but not "desCRiption".
    """
    for pat in patterns:
        pat = pat.strip().lower()
        if not pat:
            continue
        if re.search(rf"\b{re.escape(pat)}\b", header_lower):
            return True
    return False


def _suggest_column_mapping(headers: list[str]) -> dict[str, str]:
    """Auto-suggest column mapping based on header names."""
    mapping: dict[str, str] = {}
    headers_lower = [h.lower().strip() for h in headers]

    for i, header_lower in enumerate(headers_lower):
        header_original = headers[i]

        if not mapping.get("date") and _matches_pattern(header_lower, DATE_PATTERNS):
            mapping["date"] = header_original

        if not mapping.get("payee") and _matches_pattern(header_lower, PAYEE_PATTERNS):
            mapping["payee"] = header_original

        if not mapping.get("debit") and _matches_pattern(header_lower, DEBIT_PATTERNS):
            mapping["debit"] = header_original

        if not mapping.get("credit") and _matches_pattern(header_lower, CREDIT_PATTERNS):
            mapping["credit"] = header_original

        if not mapping.get("amount") and _matches_pattern(header_lower, AMOUNT_PATTERNS):
            mapping["amount"] = header_original

        if not mapping.get("memo") and _matches_pattern(header_lower, MEMO_PATTERNS):
            mapping["memo"] = header_original

    return mapping


@router.post("/read-file-headers", response_model=FileHeadersResponse)
async def read_file_headers(
    file: UploadFile = File(...),
    workspace_id: str = Depends(get_workspace_id),
):
    """
    Read CSV or XLSX file headers and return preview for column mapping.

    Auto-detects the header row (bank exports typically have a metadata preamble
    before the real column header) and captures any bank-reported balance line
    from the preamble for reconciliation (see B50, B55).
    """
    import pandas as pd  # lazy: see B4
    try:
        content = await file.read()

        filename = file.filename.lower()
        if filename.endswith('.csv'):
            file_type = "csv"
            sheet_name = None
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            file_type = "xlsx"
            xls = pd.ExcelFile(io.BytesIO(content), engine='openpyxl')
            sheet_name = xls.sheet_names[0] if xls.sheet_names else None
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Please upload a CSV or XLSX file."
            )

        df, header_idx, bank_balance = _load_transaction_file(content, file_type, sheet_name)

        headers = df.columns.tolist()

        preview_rows = []
        for _, row in df.head(5).iterrows():
            preview_rows.append({str(k): str(v) for k, v in row.items()})

        suggested_mapping = _suggest_column_mapping(headers)

        return FileHeadersResponse(
            headers=headers,
            preview_rows=preview_rows,
            suggested_mapping=suggested_mapping,
            total_rows=len(df),
            file_type=file_type,
            sheet_name=sheet_name,
            header_row_index=header_idx,
            bank_reported_balance=bank_balance,
        )

    except pd.errors.EmptyDataError as exc:
        raise HTTPException(status_code=400, detail="File is empty") from exc
    except Exception as e:  # noqa: BLE001  # top-level endpoint boundary -> 400
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}") from e


@router.post("/parse-file", response_model=FileParseResult)
async def parse_file(
    file: UploadFile = File(...),
    account_id: str = Form(...),
    column_mapping: str = Form(...),  # JSON string
    file_type: str = Form(...),
    sheet_name: str | None = Form(None),
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """
    Parse CSV or XLSX file using user-confirmed column mapping and return parsed transactions.
    """
    import json

    import pandas as pd  # lazy: see B4

    try:
        # Parse column mapping from JSON
        mapping = json.loads(column_mapping)

        # Verify account exists and belongs to workspace
        account_repo = AccountRepository(session)
        account = account_repo.read_for_workspace(account_id, workspace_id)
        if not account:
            raise NotFound("Account not found", account_id=account_id)

        content = await file.read()

        if file_type not in ("csv", "xlsx"):
            raise HTTPException(status_code=400, detail="Invalid file type")

        df, _header_idx, _bank_balance = _load_transaction_file(content, file_type, sheet_name)

        # B51: pre-fetch fingerprints of existing transactions in this workspace
        # so dedup detection is a dict lookup per row instead of a query per row.
        existing_fps: dict[str, str] = dict(
            session.query(
                TransactionModel.import_hash, TransactionModel.id
            ).filter(
                TransactionModel.workspace_id == workspace_id,
                TransactionModel.import_hash.isnot(None),
            ).all()
        )
        seen_in_file: set[str] = set()

        # Parse each row
        parsed_transactions = []

        for idx, row in df.iterrows():
            row_number = idx + 1  # 1-indexed for user display
            warnings = []
            has_errors = False

            # Extract date
            date_str = ""
            timestamp = None
            if mapping.get("date"):
                try:
                    date_str = str(row[mapping["date"]])
                    # Try to parse date with multiple formats
                    timestamp = date_parser.parse(date_str, fuzzy=True)
                except (ValueError, TypeError):
                    warnings.append(f"Invalid date format: {date_str}")
                    has_errors = True
            else:
                warnings.append("No date column mapped")
                has_errors = True

            # Extract payee
            payee = ""
            if mapping.get("payee"):
                payee = str(row[mapping["payee"]])
            else:
                warnings.append("No payee column mapped")
                has_errors = True

            # Extract memo
            memo = None
            if mapping.get("memo"):
                memo = str(row[mapping["memo"]])

            # Extract amount (handle debit/credit or single amount column)
            amount = Decimal(0)
            debit_str = None
            credit_str = None

            if mapping.get("debit") and mapping.get("credit"):
                # Separate debit/credit columns
                try:
                    debit_val = row[mapping["debit"]]
                    credit_val = row[mapping["credit"]]

                    debit_str = str(debit_val) if pd.notna(debit_val) else None
                    credit_str = str(credit_val) if pd.notna(credit_val) else None

                    debit_amount = Decimal(str(debit_val).replace(',', '')) if pd.notna(debit_val) and str(debit_val).strip() else Decimal(0)
                    credit_amount = Decimal(str(credit_val).replace(',', '')) if pd.notna(credit_val) and str(credit_val).strip() else Decimal(0)

                    # Credit is positive, debit is negative
                    amount = credit_amount - debit_amount
                except (InvalidOperation, ValueError, TypeError) as e:
                    warnings.append(f"Invalid amount values: {str(e)}")
                    has_errors = True
            elif mapping.get("amount"):
                # Single amount column
                try:
                    amount_val = row[mapping["amount"]]
                    amount_str = str(amount_val).replace(',', '').strip()

                    # Handle parentheses as negative
                    if amount_str.startswith('(') and amount_str.endswith(')'):
                        amount_str = '-' + amount_str[1:-1]

                    amount = Decimal(amount_str)
                except (InvalidOperation, ValueError, TypeError) as e:
                    warnings.append(f"Invalid amount: {str(e)}")
                    has_errors = True
            else:
                warnings.append("No amount or debit/credit columns mapped")
                has_errors = True

            # B52: text-based classification. Overrides the naive
            # "positive=income, else expense" rule for known own-account transfer
            # patterns (PayLah top-ups, credit-card payments, etc.).
            transaction_type = _classify_row(payee, memo, amount)
            pending_transfer_destination = transaction_type == "transfer"

            # B51: fingerprint + duplicate flag. Skip if we couldn't parse the row.
            fingerprint: str | None = None
            is_duplicate = False
            existing_id: str | None = None
            if timestamp is not None and not has_errors:
                fingerprint = _compute_import_fingerprint(
                    workspace_id, account_id, timestamp, amount, payee,
                )
                if fingerprint in existing_fps:
                    is_duplicate = True
                    existing_id = existing_fps[fingerprint]
                elif fingerprint in seen_in_file:
                    # Second occurrence of an identical row inside the same file.
                    is_duplicate = True
                seen_in_file.add(fingerprint)

            parsed_tx = ParsedTransaction(
                row_number=row_number,
                date_str=date_str,
                payee=payee,
                memo=memo,
                debit_str=debit_str,
                credit_str=credit_str,
                timestamp=timestamp,
                amount=amount,
                transaction_type=transaction_type,
                account_id=account_id,
                account_name=account.name,
                currency=account.account_currency,
                warnings=warnings,
                has_errors=has_errors,
                import_hash=fingerprint,
                is_duplicate=is_duplicate,
                existing_transaction_id=existing_id,
                pending_transfer_destination=pending_transfer_destination,
            )

            parsed_transactions.append(parsed_tx)

        return FileParseResult(
            total_rows=len(parsed_transactions),
            parsed_transactions=parsed_transactions,
            account_id=account_id,
            account_name=account.name
        )

    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid column mapping JSON") from exc
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Column not found in file: {str(e)}") from e
    except Exception as e:  # noqa: BLE001  # top-level endpoint boundary -> 400
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}") from e
