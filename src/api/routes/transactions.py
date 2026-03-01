"""Transaction endpoints"""

from decimal import Decimal
from typing import Optional, List, Dict
import io
import pandas as pd
from dateutil import parser as date_parser

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime

from src.data.database import get_session
from src.data.repositories import TransactionRepository, AccountRepository
from src.data.models import TransactionModel, PostingModel, FundAccountLinkModel, FundModel, AccountModel, CategoryModel
from src.api.schemas import TransactionCreate, TransferCreate, FileHeadersResponse, ParsedTransaction, FileParseResult
from src.api.deps import get_workspace_id

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
            raise HTTPException(
                status_code=404,
                detail=f"Account {posting.account_id} not found in workspace"
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
        payment_method_id=tx.payment_method_id
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


def _auto_detect_fund(session: Session, account_id: str, workspace_id: str) -> Optional[str]:
    """If an account is linked to exactly one active fund, return that fund_id."""
    links = session.query(FundAccountLinkModel).join(
        FundModel, FundAccountLinkModel.fund_id == FundModel.id
    ).filter(
        FundAccountLinkModel.account_id == account_id,
        FundModel.workspace_id == workspace_id,
        FundModel.is_active == True
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
        raise HTTPException(status_code=404, detail=f"From account {transfer.from_account_id} not found")

    to_account = account_repo.read_for_workspace(transfer.to_account_id, workspace_id)
    if not to_account:
        raise HTTPException(status_code=404, detail=f"To account {transfer.to_account_id} not found")

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
                CategoryModel.is_system == True
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
        raise HTTPException(status_code=404, detail="Transaction not found")

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
        raise HTTPException(status_code=404, detail="Transaction not found")

    account_repo = AccountRepository(session)

    # Verify all accounts exist and belong to this workspace
    for posting in tx_update.postings:
        account = account_repo.read_for_workspace(str(posting.account_id), workspace_id)
        if not account:
            raise HTTPException(
                status_code=404,
                detail=f"Account {posting.account_id} not found in workspace"
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
        raise HTTPException(status_code=404, detail="Transaction not found")

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
        raise HTTPException(status_code=404, detail="Account not found")

    repo = TransactionRepository(session)
    txs = repo.read_by_account(account_id, start_date, end_date)

    return [_serialize_tx(tx) for tx in txs]


# ─── Bank Statement Import endpoints ───

# Column name patterns for auto-detection (case-insensitive)
DATE_PATTERNS = ["date", "transaction date", "posted date", "value date", "trans date", "posting date"]
PAYEE_PATTERNS = ["description", "payee", "merchant", "particulars", "narration", "details"]
DEBIT_PATTERNS = ["debit", "withdrawal", "dr", "debit amount", "withdrawals"]
CREDIT_PATTERNS = ["credit", "deposit", "cr", "credit amount", "deposits"]
AMOUNT_PATTERNS = ["amount", "value", "transaction amount", "amt"]
MEMO_PATTERNS = ["memo", "reference", "ref", "remarks", "notes", "comment"]


def _suggest_column_mapping(headers: List[str]) -> Dict[str, str]:
    """Auto-suggest column mapping based on header names"""
    mapping = {}
    headers_lower = [h.lower().strip() for h in headers]

    for i, header_lower in enumerate(headers_lower):
        header_original = headers[i]

        # Date column
        if not mapping.get("date") and any(pattern in header_lower for pattern in DATE_PATTERNS):
            mapping["date"] = header_original

        # Payee/Description column
        if not mapping.get("payee") and any(pattern in header_lower for pattern in PAYEE_PATTERNS):
            mapping["payee"] = header_original

        # Debit column
        if not mapping.get("debit") and any(pattern in header_lower for pattern in DEBIT_PATTERNS):
            mapping["debit"] = header_original

        # Credit column
        if not mapping.get("credit") and any(pattern in header_lower for pattern in CREDIT_PATTERNS):
            mapping["credit"] = header_original

        # Amount column (if no debit/credit found)
        if not mapping.get("amount") and any(pattern in header_lower for pattern in AMOUNT_PATTERNS):
            mapping["amount"] = header_original

        # Memo column
        if not mapping.get("memo") and any(pattern in header_lower for pattern in MEMO_PATTERNS):
            mapping["memo"] = header_original

    return mapping


@router.post("/read-file-headers", response_model=FileHeadersResponse)
async def read_file_headers(
    file: UploadFile = File(...),
    workspace_id: str = Depends(get_workspace_id),
):
    """
    Read CSV or XLSX file headers and return preview for column mapping.
    """
    try:
        # Read file content
        content = await file.read()

        # Detect file type from extension
        filename = file.filename.lower()
        if filename.endswith('.csv'):
            file_type = "csv"
            # Parse CSV
            df = pd.read_csv(io.BytesIO(content))
            sheet_name = None
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            file_type = "xlsx"
            # Parse XLSX (first sheet by default)
            df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
            # Get sheet name (first sheet)
            xls = pd.ExcelFile(io.BytesIO(content), engine='openpyxl')
            sheet_name = xls.sheet_names[0] if xls.sheet_names else None
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Please upload a CSV or XLSX file."
            )

        # Get headers
        headers = df.columns.tolist()

        # Get preview rows (first 5)
        preview_rows = []
        for _, row in df.head(5).iterrows():
            preview_rows.append({str(k): str(v) for k, v in row.items()})

        # Auto-suggest column mapping
        suggested_mapping = _suggest_column_mapping(headers)

        # Total rows
        total_rows = len(df)

        return FileHeadersResponse(
            headers=headers,
            preview_rows=preview_rows,
            suggested_mapping=suggested_mapping,
            total_rows=total_rows,
            file_type=file_type,
            sheet_name=sheet_name
        )

    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="File is empty")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")


@router.post("/parse-file", response_model=FileParseResult)
async def parse_file(
    file: UploadFile = File(...),
    account_id: str = Form(...),
    column_mapping: str = Form(...),  # JSON string
    file_type: str = Form(...),
    sheet_name: Optional[str] = Form(None),
    workspace_id: str = Depends(get_workspace_id),
    session: Session = Depends(get_session)
):
    """
    Parse CSV or XLSX file using user-confirmed column mapping and return parsed transactions.
    """
    import json

    try:
        # Parse column mapping from JSON
        mapping = json.loads(column_mapping)

        # Verify account exists and belongs to workspace
        account_repo = AccountRepository(session)
        account = account_repo.read_for_workspace(account_id, workspace_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Read file content
        content = await file.read()

        # Parse file based on type
        if file_type == "csv":
            df = pd.read_csv(io.BytesIO(content))
        elif file_type == "xlsx":
            if sheet_name:
                df = pd.read_excel(io.BytesIO(content), sheet_name=sheet_name, engine='openpyxl')
            else:
                df = pd.read_excel(io.BytesIO(content), engine='openpyxl')
        else:
            raise HTTPException(status_code=400, detail="Invalid file type")

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
                except Exception:
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
                except Exception as e:
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
                except Exception as e:
                    warnings.append(f"Invalid amount: {str(e)}")
                    has_errors = True
            else:
                warnings.append("No amount or debit/credit columns mapped")
                has_errors = True

            # Determine transaction type
            transaction_type = "income" if amount > 0 else "expense"

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
                has_errors=has_errors
            )

            parsed_transactions.append(parsed_tx)

        return FileParseResult(
            total_rows=len(parsed_transactions),
            parsed_transactions=parsed_transactions,
            account_id=account_id,
            account_name=account.name
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid column mapping JSON")
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Column not found in file: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
