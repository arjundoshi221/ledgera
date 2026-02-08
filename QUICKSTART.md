"""Quick start guide for Ledgera"""

# Ledgera Framework - Quick Start

## Structure Overview

```
ledgera/
├── src/
│   ├── domain/                    # Business logic layer (pure Python)
│   │   ├── __init__.py
│   │   ├── models.py             # Domain entities (Account, Transaction, etc.)
│   │   ├── ledger.py             # Double-entry accounting logic
│   │   └── projections.py        # Deterministic projection engine
│   │
│   ├── data/                      # Data persistence layer
│   │   ├── __init__.py
│   │   ├── models.py             # SQLAlchemy ORM models
│   │   ├── repositories.py       # Repository pattern implementations
│   │   └── database.py           # DB connection management
│   │
│   ├── services/                  # External integrations
│   │   ├── __init__.py
│   │   ├── price_service.py      # FX rates / stock prices (Yahoo Finance)
│   │   ├── csv_importer.py       # CSV transaction import
│   │   └── categorization_engine.py # Rules-based auto-categorization
│   │
│   └── api/                       # REST API layer (FastAPI)
│       ├── __init__.py
│       ├── main.py               # FastAPI app initialization
│       ├── schemas.py            # Pydantic request/response models
│       └── routes/
│           ├── __init__.py
│           ├── accounts.py       # Account endpoints
│           ├── transactions.py   # Transaction endpoints
│           ├── projections.py    # Projection/forecasting endpoints
│           └── prices.py         # Price/FX endpoints
│
├── tests/                         # Test suite
│   ├── conftest.py              # Pytest fixtures
│   ├── test_domain_models.py    # Domain model tests
│   ├── test_ledger.py           # Ledger operation tests
│   └── test_projections.py      # Projection engine tests
│
├── config/                        # Configuration
│   ├── settings.py              # App settings
│   └── migrations.md            # Database migration guide
│
├── main.py                        # Application entry point
├── requirements.txt              # Python dependencies
├── setup.py                       # Package setup
├── .gitignore                     # Git ignore rules
└── README_BACKEND.md             # Backend documentation
```

## Key Components

### 1. Domain Layer (src/domain/)
**Pure business logic independent of frameworks**

- **models.py**: Immutable domain entities
  - Account: Bank/investment account
  - Transaction: Double-entry transaction
  - Posting: Individual debit/credit line
  - Price: FX rate or security price
  - Scenario: Planning scenario
  - ProjectionAssumption: Forecast model input
  - ProjectionResult: Forecast calculation output

- **ledger.py**: Core accounting engine
  - Double-entry validation
  - Account balance calculation
  - Transaction filtering and search

- **projections.py**: Deterministic projection engine
  - Monthly cash flow modeling
  - Multi-currency support
  - Expense inflation modeling
  - Bucket allocation and growth

### 2. Data Layer (src/data/)
**ORM and repository pattern**

- **models.py**: SQLAlchemy mappings
  - Tables: accounts, transactions, postings, categories, tags, prices, scenarios

- **repositories.py**: Data access abstraction
  - Account, Transaction, Category, Price, Scenario repositories
  - CRUD operations with filtering

- **database.py**: Connection pooling and session management

### 3. Services Layer (src/services/)
**External integrations and business logic**

- **price_service.py**: FX rates and security prices
  - Yahoo Finance provider
  - Caching support
  - Multi-currency conversion

- **csv_importer.py**: CSV transaction import
  - Flexible column mapping
  - Double-entry transaction creation
  - Date/amount parsing

- **categorization_engine.py**: Rules-based auto-categorization
  - Payee matching
  - Amount range filtering
  - Extensible rule system

### 4. API Layer (src/api/)
**FastAPI REST endpoints**

Endpoints organized by resource:
- `/api/v1/accounts/` - Account management
- `/api/v1/transactions/` - Transaction CRUD and queries
- `/api/v1/projections/` - Forecasting and scenario analysis
- `/api/v1/prices/` - FX rates and security prices

## Usage Examples

### 1. Create Domain Objects (no DB required)

```python
from src.domain.models import Account, AccountType, Posting, Transaction
from src.domain.ledger import Ledger
from decimal import Decimal

# Create accounts
checking = Account(name="Checking", account_type=AccountType.ASSET)
income = Account(name="Salary", account_type=AccountType.INCOME)

# Create ledger
ledger = Ledger()
ledger.add_account(checking)
ledger.add_account(income)

# Create balanced transaction
posting1 = Posting(account_id=checking.id, amount=Decimal(5000), base_amount=Decimal(5000))
posting2 = Posting(account_id=income.id, amount=Decimal(-5000), base_amount=Decimal(-5000))

tx = Transaction(payee="Employer", postings=[posting1, posting2])
ledger.add_transaction(tx)

# Get balance
balance = ledger.get_account_balance(checking.id)
print(f"Checking balance: {balance}")  # 5000
```

### 2. Run Projections

```python
from src.domain.projections import ProjectionEngine, ProjectionAssumptions
from decimal import Decimal

assumptions = ProjectionAssumptions(
    monthly_salary=Decimal(5000),
    tax_rate=Decimal("0.20"),
    monthly_expenses=Decimal(3000),
    allocation_weights={"cash": Decimal("0.3"), "invest": Decimal("0.7")},
    bucket_returns={"cash": Decimal("0.0"), "invest": Decimal("0.08")}
)

engine = ProjectionEngine(assumptions)
projections = engine.project_period(12)  # 12 months

for proj in projections:
    print(f"{proj.period}: Savings={proj.savings}, Rate={proj.savings_rate:.1%}")
```

### 3. Start API Server

```bash
python -m uvicorn src.api.main:app --reload
```

Then access:
- Swagger UI: http://localhost:8000/docs
- API: http://localhost:8000/api/v1/

### 4. Run Tests

```bash
pytest tests/ -v
pytest tests/test_projections.py -v  # Specific test file
```

## Configuration

### Environment Variables (config/settings.py)

```bash
export DATABASE_URL="sqlite:///./ledgera.db"
export API_HOST="0.0.0.0"
export API_PORT=8000
export BASE_CURRENCY="SGD"
export PRICE_PROVIDER="yahoo_finance"
export PRICE_CACHE_TTL=3600
```

## Next Steps

### Short-term (MVP)
- [ ] Complete API endpoints for all resources
- [ ] Add data migrations with Alembic
- [ ] Implement CSV import workflow
- [ ] Build iOS frontend (SwiftUI)
- [ ] Add user authentication

### Medium-term (V1)
- [ ] CloudKit sync adapter
- [ ] Reconciliation workflow
- [ ] Scenario comparison UI
- [ ] Rules-based categorization
- [ ] Investment tracking

### Long-term (V2+)
- [ ] Stochastic projections (Monte Carlo)
- [ ] Tax optimization
- [ ] Family/shared vault
- [ ] Bank statement aggregation API
- [ ] Mobile app refinement

## Architecture Principles

1. **Separation of Concerns**
   - Domain layer: Pure business logic
   - Data layer: Persistence mechanism
   - Services: External integrations
   - API: Presentation layer

2. **Double-Entry Accounting**
   - Every transaction balances
   - Immutable ledger entries
   - Audit trail built-in

3. **Multi-Currency Support**
   - Native and base currency amounts
   - FX rates at booking time
   - Conversion flexibility

4. **Testability**
   - Domain logic testable without DB
   - Repositories mockable
   - Fixtures included

## Resources

- [Backend README](README_BACKEND.md)
- [Documentation](documentation/documentation.ipynb)
- [Alembic Migrations Guide](config/migrations.md)

---

**Ledgera** - Banking + Planning + Accounting in one app
