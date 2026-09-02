"""Architecture Overview"""

# Ledgera Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        iOS Frontend (SwiftUI)                      │
│                    [Not in this Python skeleton]                   │
└────────────────────────┬──────────────────────────────────────────┘
                         │ HTTP/HTTPS (JSON)
┌────────────────────────▼──────────────────────────────────────────┐
│                      FastAPI REST Server                          │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    API Routes (Layer)                        │ │
│  ├───────────┬────────────────┬─────────────┬──────────────────┤ │
│  │ Accounts  │ Transactions   │ Projections │ Prices / FX      │ │
│  └──────┬────┴────────┬───────┴──────┬──────┴────────┬─────────┘ │
│         │             │              │               │           │
└────────┼─────────────┼──────────────┼───────────────┼───────────┘
         │             │              │               │
┌────────▼─────────────▼──────────────▼───────────────▼───────────┐
│               Business Logic Layer (Domain)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ • Double-entry accounting (Ledger)                       │   │
│  │ • Projection engine (deterministic forecasting)          │   │
│  │ • Domain models (pure, framework-agnostic)               │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌───▼──────┐
    │  Data   │ │Services │ │ External │
    │ Layer   │ │ Layer   │ │  APIs    │
    └────┬────┘ └────┬────┘ └───┬──────┘
         │           │           │
    ┌────▼───────────▼───────────▼───────┐
    │    Persistence & Integrations      │
    ├────────────────────────────────────┤
    │ • SQLite Database (SQLAlchemy)     │
    │ • Yahoo Finance (Price Service)    │
    │ • CSV Import Pipeline              │
    │ • CloudKit Sync (future)           │
    └────────────────────────────────────┘
```

## Data Flow

### Transaction Creation
```
User Input (UI)
    ↓
FastAPI Route (POST /transactions)
    ↓
Pydantic Validation (Schema)
    ↓
Domain Model Creation (Transaction + Postings)
    ↓
Balance Validation (Double-entry check)
    ↓
Repository Save (SQLAlchemy)
    ↓
Database (SQLite)
```

### Projection Calculation
```
User Input (Assumptions)
    ↓
ProjectionEngine.project_period()
    ↓
For each month:
  - Calculate income (with tax)
  - Calculate expenses (with inflation)
  - Calculate savings
  - Allocate to buckets
  - Apply returns to each bucket
    ↓
Return monthly projections
    ↓
API Response (JSON)
    ↓
iOS App UI (Charts/Tables)
```

### Price/FX Fetch
```
API Request (GET /prices/fx/SGD/USD)
    ↓
PriceService.get_fx_rate()
    ↓
YahooFinancePriceProvider.get_rate()
    ↓
Yahoo Finance API (yfinance library)
    ↓
Cache result (TTL: 1 hour)
    ↓
Return Decimal rate
    ↓
Store in database (optional)
```

## Module Dependencies

```
src/api/main.py
    ├── depends on: src/api/routes/*
    ├── depends on: src/api/schemas
    └── depends on: src/data/database

src/api/routes/*.py
    ├── depends on: src/data/repositories
    ├── depends on: src/data/database
    ├── depends on: src/domain/*
    └── depends on: src/services/*

src/data/repositories.py
    ├── depends on: src/data/models
    └── depends on: sqlalchemy

src/domain/*.py
    ├── NO external dependencies
    └── Pure Python (dataclasses, decimal, etc.)

src/services/*.py
    ├── may depend on: src/domain/models
    ├── depends on: external libraries (yfinance, pandas, etc.)
    └── NO database dependencies

tests/*
    ├── depends on: src/domain/*
    ├── depends on: pytest
    └── uses fixtures (conftest.py)
```

## Class Hierarchy

### Domain Models
```
Account
  ├── account_type: AccountType (enum)
  └── balance: Decimal

Transaction
  ├── timestamp: datetime
  ├── payee: str
  ├── status: TransactionStatus (enum)
  └── postings: List[Posting]

Posting
  ├── account_id: UUID
  ├── amount: Decimal (native currency)
  ├── base_amount: Decimal (converted to base)
  └── fx_rate: Decimal

Scenario
  ├── assumptions: List[ProjectionAssumption]
  └── results: List[ProjectionResult]

Price
  ├── base_ccy: str (e.g., SGD)
  ├── quote_ccy: str (e.g., USD)
  └── rate: Decimal
```

### Services
```
PriceProvider (ABC)
  ├── YahooFinancePriceProvider (implementation)
  └── PriceService (facade)

CSVImporter
  └── parse_transactions()

CategorizationEngine
  └── categorize()

Ledger
  ├── add_account()
  ├── add_transaction()
  └── get_account_balance()

ProjectionEngine
  ├── project_month()
  └── project_period()
```

## Error Handling

### Transaction Validation
```python
# Double-entry validation at domain level
if not transaction.is_balanced():
    raise ValueError("Transaction not balanced")

# API validation at schema level
# (Pydantic handles type checking)
```

### Database Operations
```python
# Repository pattern handles DB errors
try:
    repository.create(entity)
except Exception as e:
    # Log and return appropriate HTTP error
    raise HTTPException(status_code=400)
```

## Performance Considerations

### Scalability
1. **Database Indexing**
   - transactions.timestamp
   - postings.account_id
   - prices.base_ccy, quote_ccy, timestamp

2. **Caching**
   - FX rates (TTL: 1 hour)
   - Account balances (precomputed daily/monthly)

3. **Query Optimization**
   - Batch posting creation
   - Lazy loading relationships

### Future Optimizations
- Read replicas for analytics
- Event sourcing for ledger
- Time-series DB for prices
- Async processing for imports

## Security

### Current MVP
- SQLite local storage (encrypted by iOS)
- No authentication (local-only)

### iOS Platform
- Data Protection API
- Keychain for secrets

### Future
- OAuth/JWT authentication
- API rate limiting
- Data encryption at rest
- Audit logging

## Testing Strategy

```
Unit Tests
  ├── Domain models (conftest.py fixtures)
  ├── Ledger operations
  └── Projection calculations

Integration Tests (future)
  ├── API endpoints
  ├── Database operations
  └── Service integrations

E2E Tests (future)
  ├── CSV import workflow
  ├── Projection generation
  └── iOS app sync
```

## Deployment

### Development
```bash
python -m uvicorn src.api.main:app --reload
```

### Production (future)
```bash
# Gunicorn/ASGI server
gunicorn -w 4 -k uvicorn.workers.UvicornWorker src.api.main:app

# Or with Docker
docker build -t ledgera .
docker run -p 8000:8000 ledgera
```

## Technology Stack

| Layer      | Technology                    | Purpose                      |
|-----------|-------------------------------|------------------------------|
| Frontend  | SwiftUI (iOS)                | Native iOS app (future)      |
| API       | FastAPI                      | REST endpoints               |
| Validation| Pydantic                     | Request/response schemas     |
| Database  | SQLite + SQLAlchemy          | Persistent storage           |
| ORM       | SQLAlchemy                   | Object-relational mapping    |
| Migration | Alembic                      | Schema versioning            |
| Sync      | CloudKit (future)            | iCloud sync                  |
| Prices    | yfinance                     | FX rates & security prices   |
| Testing   | pytest                       | Unit/integration testing     |
| Types     | Python 3.9+ type hints       | Static type checking         |

---

For implementation details, see [QUICKSTART.md](QUICKSTART.md) and [README_BACKEND.md](README_BACKEND.md)
