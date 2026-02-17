# Ledgera MVP v0 — Detailed Design Doc

**Scope**: Multi-user (isolated), scalable-ready, double-entry accounting, CSV/manual entry, projections, FX fetch.

**Build approach**: Auth + workspace foundation first, then data models, then API, then validation.

---

## 1. Data Model (SQL Schema)

### Core entities (all timestamps UTC, all IDs as UUID v4)

#### `users`
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_users_email ON users(email);
```

**Domain model** (`User`):
```python
@dataclass
class User:
    id: UUID
    email: str
    display_name: str
    created_at: datetime
    is_active: bool
```

---

#### `workspaces`
```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Personal',
    base_currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_workspaces_owner ON workspaces(owner_user_id);
```

**Domain model** (`Workspace`):
```python
@dataclass
class Workspace:
    id: UUID
    owner_user_id: UUID
    name: str
    base_currency: str  # ISO 4217
    created_at: datetime
    updated_at: datetime
```

**MVP rule**: Auto-create on user signup: `workspace = Workspace(name='Personal', owner_user_id=new_user.id)`.

---

#### `accounts`
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- asset, liability, income, expense, equity
    account_currency VARCHAR(3) NOT NULL,  -- e.g., SGD, USD, AED
    institution VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_workspace ON accounts(workspace_id);
CREATE INDEX idx_accounts_active ON accounts(workspace_id, is_active);
```

**Domain model** (`Account`):
```python
@dataclass
class Account:
    id: UUID
    workspace_id: UUID
    name: str
    type: AccountType  # enum: ASSET, LIABILITY, INCOME, EXPENSE, EQUITY
    account_currency: str  # Posting currency, not workspace base
    institution: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

---

#### `transactions`
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    payee VARCHAR(255),
    memo TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'unreconciled',  -- unreconciled, reconciled, pending
    source VARCHAR(50),  -- manual, csv_import, sync, etc.
    import_hash VARCHAR(64),  -- SHA-256 of (payee + amount + timestamp) for deduplication
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, import_hash)  -- Null-safe: only one tx per import per workspace
);
CREATE INDEX idx_transactions_workspace_timestamp ON transactions(workspace_id, timestamp DESC);
CREATE INDEX idx_transactions_import ON transactions(workspace_id, import_hash) WHERE import_hash IS NOT NULL;
```

**Domain model** (`Transaction`):
```python
@dataclass
class Transaction:
    id: UUID
    workspace_id: UUID
    timestamp: datetime
    payee: str
    memo: str
    status: TransactionStatus  # enum
    source: str
    import_hash: Optional[str]  # For dedup; computed as sha256(payee+amount+date)
    postings: List[Posting]
    created_at: datetime
    updated_at: datetime

    def is_balanced_in_base(self, base_currency: str) -> bool:
        """Check sum of base_amounts == 0 within tolerance."""
        total = sum(p.base_amount for p in self.postings)
        return abs(total) < Decimal("0.01")
```

---

#### `postings`
```sql
CREATE TABLE postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    amount DECIMAL(19, 4) NOT NULL,  -- In posting_currency (usually account_currency)
    posting_currency VARCHAR(3) NOT NULL,
    fx_rate_to_base DECIMAL(19, 6) NOT NULL DEFAULT 1.0,  -- Snapshot at tx time
    base_amount DECIMAL(19, 4) NOT NULL,  -- amount * fx_rate_to_base
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_postings_transaction ON postings(transaction_id);
CREATE INDEX idx_postings_account ON postings(account_id);
```

**Domain model** (`Posting`):
```python
@dataclass
class Posting:
    id: UUID
    transaction_id: UUID
    account_id: UUID
    amount: Decimal  # Native currency
    posting_currency: str
    fx_rate_to_base: Decimal  # Snapshot at booking time
    base_amount: Decimal  # amount * fx_rate_to_base (pre-computed, indexed)
    created_at: datetime
```

---

#### `categories` (unchanged from skeleton, but add workspace_id)
```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES categories(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, name)
);
CREATE INDEX idx_categories_workspace ON categories(workspace_id);
```

---

#### `prices` (cache layer for FX)
```sql
CREATE TABLE prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_ccy VARCHAR(3) NOT NULL,
    quote_ccy VARCHAR(3) NOT NULL,
    rate DECIMAL(19, 6) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(50),  -- yahoo_finance, manual, etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_prices_pair_timestamp ON prices(base_ccy, quote_ccy, timestamp DESC);
```

---

#### `import_batches` (optional, for tracking CSV imports)
```sql
CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    total_rows INTEGER,
    imported_count INTEGER,
    error_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_batches_workspace ON import_batches(workspace_id);
```

---

## 2. Domain Models (Python)

### Updated `src/domain/models.py`

```python
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from uuid import UUID, uuid4

# Auth
@dataclass
class User:
    id: UUID = field(default_factory=uuid4)
    email: str = ""
    display_name: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True
    # hashed_password NOT in domain (handled by service layer)

@dataclass
class Workspace:
    id: UUID = field(default_factory=uuid4)
    owner_user_id: UUID = field(default_factory=uuid4)
    name: str = "Personal"
    base_currency: str = "SGD"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

# Accounting (updated)
class AccountType(str, Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    INCOME = "income"
    EXPENSE = "expense"
    EQUITY = "equity"

class TransactionStatus(str, Enum):
    UNRECONCILED = "unreconciled"
    RECONCILED = "reconciled"
    PENDING = "pending"

@dataclass
class Account:
    id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    name: str = ""
    type: AccountType = AccountType.ASSET
    account_currency: str = "SGD"
    institution: Optional[str] = None
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Posting:
    id: UUID = field(default_factory=uuid4)
    transaction_id: UUID = field(default_factory=uuid4)
    account_id: UUID = field(default_factory=uuid4)
    amount: Decimal = Decimal(0)
    posting_currency: str = "SGD"
    fx_rate_to_base: Decimal = Decimal(1)
    base_amount: Decimal = Decimal(0)  # amount * fx_rate_to_base
    created_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Transaction:
    id: UUID = field(default_factory=uuid4)
    workspace_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    payee: str = ""
    memo: str = ""
    status: TransactionStatus = TransactionStatus.UNRECONCILED
    source: str = ""
    import_hash: Optional[str] = None  # For idempotency
    postings: List[Posting] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def is_balanced_in_base(self) -> bool:
        """Check if sum of base_amounts == 0 (tolerance: ±0.01 base cents)."""
        total = sum(p.base_amount for p in self.postings)
        return abs(total) < Decimal("0.01")

@dataclass
class Price:
    id: UUID = field(default_factory=uuid4)
    base_ccy: str = "SGD"
    quote_ccy: str = "USD"
    rate: Decimal = Decimal(1)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    source: str = "manual"
    created_at: datetime = field(default_factory=datetime.utcnow)
```

---

## 3. API Routes (RESTful)

### Auth endpoints

**POST /auth/signup**
```
Request:
{
  "email": "user@example.com",
  "password": "secure...",  // Not transmitted; use HTTPS
  "display_name": "Jane Doe"
}

Response (201):
{
  "user_id": "uuid",
  "workspace_id": "uuid",
  "access_token": "jwt...",
  "token_type": "bearer"
}

Side effect:
  - Create User record
  - Create Workspace (name="Personal", base_currency="SGD")
  - Issue JWT token
```

**POST /auth/login**
```
Request:
{
  "email": "user@example.com",
  "password": "secure..."
}

Response (200):
{
  "access_token": "jwt...",
  "token_type": "bearer",
  "workspace_id": "uuid"
}
```

**GET /me**
```
Response (200):
{
  "user_id": "uuid",
  "email": "user@example.com",
  "display_name": "Jane Doe"
}
Auth: Bearer token required
```

---

### Workspace endpoints

**GET /workspace**
```
Response (200):
{
  "id": "uuid",
  "owner_user_id": "uuid",
  "name": "Personal",
  "base_currency": "SGD"
}
Auth: Bearer token required
```

**PATCH /workspace**
```
Request:
{
  "base_currency": "USD"  // Only change base currency (locked for now)
}

Response (200): Updated workspace object
Auth: Bearer token required
```

---

### Account endpoints

**POST /accounts**
```
Request:
{
  "name": "Checking (DBS)",
  "type": "asset",
  "account_currency": "SGD",
  "institution": "DBS"
}

Response (201):
{
  "id": "uuid",
  "workspace_id": "uuid",
  "name": "Checking (DBS)",
  "type": "asset",
  "account_currency": "SGD",
  "is_active": true,
  "created_at": "2026-01-15T..."
}
Auth: Bearer token required
Validation: type ∈ {asset, liability, income, expense, equity}
```

**GET /accounts**
```
Response (200):
{
  "accounts": [
    {
      "id": "uuid",
      "name": "...",
      "type": "asset",
      "account_currency": "SGD",
      "is_active": true
    },
    ...
  ]
}
Auth: Bearer token required
Filter: ?is_active=true (optional)
```

**PATCH /accounts/{id}**
```
Request:
{
  "name": "Checking (Updated)",
  "is_active": false  // Soft archive
}

Response (200): Updated account
Auth: Bearer token required
Validation: Can only edit name, is_active; currency/type locked
```

---

### Transaction endpoints

**POST /transactions**
```
Request:
{
  "timestamp": "2026-01-15T10:00:00Z",
  "payee": "Employer Inc",
  "memo": "Monthly salary",
  "status": "unreconciled",
  "source": "manual",
  "postings": [
    {
      "account_id": "uuid",
      "amount": 5000,
      "posting_currency": "SGD",
      "fx_rate_to_base": 1.0
    },
    {
      "account_id": "uuid",
      "amount": -5000,
      "posting_currency": "SGD",
      "fx_rate_to_base": 1.0
    }
  ]
}

Response (201): Transaction object with postings
Auth: Bearer token required
Validation:
  - All accounts exist in workspace (404 if not)
  - Sum of base_amounts == 0 (400 if not)
  - Timestamp is valid
```

**GET /transactions**
```
Query params:
  - ?start_date=2026-01-01
  - ?end_date=2026-01-31
  - ?account_id=uuid
  - ?payee=Employer  (substring search)
  - ?limit=50&offset=0 (pagination)

Response (200):
{
  "transactions": [
    {
      "id": "uuid",
      "timestamp": "...",
      "payee": "...",
      "status": "unreconciled",
      "postings": [...]
    },
    ...
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
Auth: Bearer token required
Scoping: Only transactions in current workspace
```

**GET /balances**
```
Query params:
  - ?as_of=2026-01-31 (default: now)

Response (200):
{
  "base_currency": "SGD",
  "as_of": "2026-01-31T23:59:59Z",
  "balances": {
    "account_id": {
      "account_name": "Checking (DBS)",
      "account_currency": "SGD",
      "balance_in_account_currency": 5000,
      "balance_in_base_currency": 5000,
      "fx_rate": 1.0
    },
    ...
  }
}
Auth: Bearer token required
Calculation: For each account, sum postings by posting currency; convert to base if needed
```

---

### CSV Import endpoint

**POST /imports/csv**
```
Request (multipart):
  file: <CSV file>
  column_mapping: {
    "date": "Date",
    "payee": "Description",
    "amount": "Amount",
    "memo": "Notes"
  }  // Optional; defaults to common names
  debit_account_id: "uuid"  // Where to post if import is expense

Response (201):
{
  "import_id": "uuid",
  "total_rows": 10,
  "created_count": 9,
  "skipped_count": 1,  // (duplicates)
  "error_count": 0,
  "errors": [
    {
      "row": 5,
      "reason": "Invalid date format"
    }
  ],
  "transactions": [
    { "id": "uuid", "payee": "...", "amount": 100, "import_hash": "sha256..." }
  ]
}
Auth: Bearer token required
Side effect:
  - Compute import_hash = sha256(payee + amount + date)
  - Check UNIQUE(workspace_id, import_hash); skip if exists
  - Create transaction(s) + postings with source="csv_import"
  - Track in import_batches table
Idempotency: Re-upload same CSV → no new transactions (same import_hash)
```

---

### Projection endpoint

**POST /projections**
```
Request:
{
  "months": 12,
  "assumptions": {
    "monthly_salary": 5000,
    "annual_bonus": 10000,
    "monthly_expenses": 3000,
    "tax_rate": 0.20,
    "expense_inflation_rate": 0.03,
    "allocation_weights": {
      "cash": 0.3,
      "invest": 0.7
    },
    "bucket_returns": {
      "cash": 0.0,
      "invest": 0.08
    }
  }
}

Response (200):
{
  "scenario_id": "uuid",  // For future v1 scenario comparison
  "base_currency": "SGD",
  "months": [
    {
      "period": "2026-02",
      "gross_income": 5833,  // (5000 + 10000/12)
      "taxes": 1167,
      "net_income": 4667,
      "expenses": 3000,
      "savings": 1667,
      "savings_rate": 0.357,
      "bucket_allocations": {
        "cash": 500,
        "invest": 1167
      },
      "bucket_balances": {
        "cash": 500,
        "invest": 1200  // (previous * (1+08%)^(1/12)) + 1167
      }
    },
    ...
  ]
}
Auth: Bearer token required
Calculation: Deterministic, no DB access (pure math)
```

---

### FX endpoint

**GET /fx/{base}/{quote}**
```
Example: GET /fx/SGD/USD

Response (200):
{
  "base_ccy": "SGD",
  "quote_ccy": "USD",
  "rate": 0.74,
  "timestamp": "2026-01-15T12:00:00Z",
  "source": "yahoo_finance"
}

Auth: Bearer token NOT required (public)
Caching:
  - In-memory cache (TTL: 1 hour)
  - Also store in prices table for audit
  - On cache miss, fetch from yfinance
Error handling:
  - If yfinance fails, return last cached rate + "best_effort": true
  - If no cache exists, return 400 with "source not available"
```

---

## 4. Authentication & Authorization

### JWT flow

1. **Signup**: Hash password using `argon2`; issue JWT with `(user_id, workspace_id)` claims.
2. **Login**: Verify password; issue JWT.
3. **Every request**: Extract `Bearer token` from `Authorization` header; validate signature + expiry.
4. **Claims**: 
   ```json
   {
     "sub": "user_id",
     "workspace_id": "workspace_id",
     "exp": 1704067200
   }
   ```

### Middleware: Workspace scoping

On every request:
1. Extract JWT → get `workspace_id`
2. Pass `workspace_id` to repository/service layer
3. All queries auto-filtered by `workspace_id` 
4. If accessing a resource (account, transaction) from different workspace → 404 (not 403, to avoid leaking workspace existence)

---

## 5. Multi-user isolation tests

### Acceptance criteria

| Criteria | Test case | Expected outcome |
|----------|-----------|------------------|
| User sees only own workspace | User B logs in, fetches `/workspace` | Returns User B's workspace, not A's |
| User cannot read other's accounts | User A tries to `GET /accounts/{uuid_of_B_account}` | 404 (not 403) |
| User cannot create tx on other's account | User A tries `POST /transactions` with B's account | 400 invalid account ref + 404 |
| Unbalanced tx rejected | `POST /transactions` with base_amount sum ≠ 0 | 400 "transaction not balanced" |
| CSV import is idempotent | Upload same CSV twice | Second upload: all rows skipped (same import_hash) |
| FX rate caching | `GET /fx/SGD/USD` twice within 1h | Second call hits cache, timestamp identical |

### Test file: `tests/test_multi_user_isolation.py`

```python
def test_user_a_cannot_read_user_b_accounts(client, user_a, user_b):
    """User A should not see User B's accounts (404, not 403)."""
    token_b = create_and_login(user_b)
    acc_b = client.post(
        "/accounts",
        json={"name": "B's account", "type": "asset", "account_currency": "SGD"},
        headers={"Authorization": f"Bearer {token_b}"}
    ).json()
    
    token_a = create_and_login(user_a)
    resp = client.get(
        f"/accounts/{acc_b['id']}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert resp.status_code == 404

def test_unbalanced_transaction_rejected(client, user, accounts):
    """Posting with sum(base_amount) ≠ 0 should return 400."""
    token = create_and_login(user)
    resp = client.post(
        "/transactions",
        json={
            "timestamp": "2026-01-15T10:00:00Z",
            "payee": "Test",
            "postings": [
                {"account_id": accounts[0], "amount": 100, "posting_currency": "SGD", "fx_rate_to_base": 1.0},
                {"account_id": accounts[1], "amount": -50, "posting_currency": "SGD", "fx_rate_to_base": 1.0}
            ]
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 400
    assert "not balanced" in resp.json()["detail"]

def test_csv_import_idempotent(client, user):
    """Re-upload same CSV → no new transactions."""
    token = create_and_login(user)
    csv_content = "Date,Description,Amount\n2026-01-15,Salary,5000\n"
    
    # First import
    resp1 = client.post(
        "/imports/csv",
        files={"file": ("test.csv", csv_content)},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp1.json()["created_count"] == 1
    
    # Second import (same file)
    resp2 = client.post(
        "/imports/csv",
        files={"file": ("test.csv", csv_content)},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp2.json()["created_count"] == 0
    assert resp2.json()["skipped_count"] == 1
```

---

## 6. Implementation roadmap

### Phase 1: Auth + Workspace (Foundations)
- [ ] Add `User`, `Workspace` domain models
- [ ] Add `UserModel`, `WorkspaceModel` ORM
- [ ] Create `UserRepository`, `WorkspaceRepository`
- [ ] Implement JWT generation/validation (use `PyJWT`)
- [ ] Add password hashing (`argon2`)
- [ ] Write `/auth/signup`, `/auth/login`, `/me`
- [ ] Write `/workspace` GET/PATCH
- [ ] Add middleware to extract `workspace_id` from JWT
- [ ] Tests: login/signup happy path + error cases

### Phase 2: Data model updates
- [ ] Add `workspace_id` to `AccountModel`, `TransactionModel`
- [ ] Add `fx_rate_to_base`, `base_amount` to `PostingModel`
- [ ] Add `import_hash` to `TransactionModel`
- [ ] Add `base_currency` to `WorkspaceModel`
- [ ] Update all repositories to filter by `workspace_id`
- [ ] Create `CategoryModel` with `workspace_id`
- [ ] Alembic migrations (schema sync)

### Phase 3: Core API + validation
- [ ] Account endpoints (POST, GET, PATCH)
- [ ] Transaction endpoints (POST, GET)
- [ ] Balances endpoint (GET)
- [ ] CSV import (POST) with deduplication
- [ ] Projection endpoint (POST)
- [ ] FX endpoint (GET) with caching
- [ ] Error handling + 403/404 logic
- [ ] Tests: each endpoint happy path + error cases

### Phase 4: Multi-user tests + hardening
- [ ] Multi-user isolation tests
- [ ] Idempotency tests (CSV import)
- [ ] Balance validation tests
- [ ] Currency conversion tests
- [ ] Edge cases (null values, invalid dates, etc.)

---

## 7. File changes (summary)

| File | Change |
|------|--------|
| `src/domain/models.py` | Add `User`, `Workspace`; update `Account`, `Transaction`, `Posting` |
| `src/data/models.py` | Add `UserModel`, `WorkspaceModel`; update others with `workspace_id`, FX fields |
| `src/data/repositories.py` | Add `UserRepository`, `WorkspaceRepository`; update existing with `workspace_id` |
| `src/data/database.py` | Keep unchanged (sessionmaker, init_db) |
| `src/services/auth_service.py` | **NEW**: JWT, password hashing, signup/login flows |
| `src/services/price_service.py` | Add in-memory cache + error handling |
| `src/api/main.py` | Add auth middleware; register auth router |
| `src/api/schemas.py` | Add request/response schemas for all endpoints |
| `src/api/routes/auth.py` | **NEW**: /auth/signup, /auth/login, /me |
| `src/api/routes/workspace.py` | **NEW**: /workspace GET/PATCH |
| `src/api/routes/accounts.py` | Update to workspace-scoped |
| `src/api/routes/transactions.py` | Update to workspace-scoped + balance validation |
| `src/api/routes/imports.py` | **NEW**: /imports/csv with deduplication |
| `src/api/routes/balances.py` | **NEW**: /balances with base currency conversion |
| `src/api/routes/fx.py` | Update with caching |
| `src/api/middleware.py` | **NEW**: Extract workspace_id from JWT |
| `tests/test_multi_user_isolation.py` | **NEW**: Multi-user + isolation tests |
| `tests/test_auth.py` | **NEW**: Auth flow tests |
| `requirements.txt` | Add `PyJWT`, `passlib`, `argon2-cffi` (update if needed) |

---

## 8. Database migration strategy

### For MVP development

1. Keep using **SQLite** during dev (easy, file-based).
2. Use **Alembic** from day 1 to track schema (even if just for history).
3. When deploying to production → switch to **Postgres**.

### Migration files

```bash
alembic init alembic
alembic revision --autogenerate -m "Initial schema: users, workspaces, accounts, transactions"
alembic upgrade head
```

Each revision in `alembic/versions/` tracks schema change (idempotent, reversible).

---

## 9. Acceptance criteria checklist

- [ ] Two users cannot read/write each other's data (hard 404)
- [ ] Account currency is selectable; reports show base currency balance
- [ ] Unbalanced transactions are rejected with clear error
- [ ] CSV import is idempotent (re-upload → skipped)
- [ ] FX rates fetch from yfinance; cache for 1h
- [ ] Projections compute in < 100ms (pure math)
- [ ] All endpoints require Bearer token auth (except /fx)
- [ ] All list endpoints support pagination (`limit`, `offset`)
- [ ] All error responses follow standard format: `{"error": "...", "detail": "..."}`

---

## 10. Key tech choices explained

| Choice | Why |
|--------|-----|
| JWT (not session) | Stateless, scalable to distributed backends |
| Argon2 (not bcrypt) | Modern, memory-hard, resistant to GPU attack |
| UUID v4 (not serial int) | Privacy (hard to guess), friendly to distributed DBs (Postgres later) |
| `Decimal` (not float) | Financial data must be exact; no floating-point rounding errors |
| Import hash (SHA-256) | Idempotency + audit (what was the exact input?) |
| Workspace from day 1 | Shared ledgers in v1 don't require refactor; just add `workspace_members` table |

---

**Next step**: Confirm this design, then implement Phase 1 (Auth + Workspace) in full.
