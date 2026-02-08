"""README for Ledgera Backend"""

# Ledgera Backend

Dual-approach banking + projections + line-by-line accounting.

## Project Structure

```
src/
├── domain/          # Business logic (pure Swift/Python)
│   ├── models.py    # Domain entities
│   ├── ledger.py    # Ledger core operations
│   └── projections.py # Projection engine
├── data/            # Data layer
│   ├── models.py    # SQLAlchemy ORM models
│   ├── repositories.py # Data access patterns
│   └── database.py  # Database connection
├── services/        # External integrations
│   ├── price_service.py # FX rates, security prices
│   ├── csv_importer.py # CSV import pipeline
│   └── categorization_engine.py # Auto-categorization rules
└── api/             # FastAPI endpoints
    ├── main.py      # FastAPI app
    ├── schemas.py   # Pydantic models
    └── routes/      # Endpoint routers
        ├── accounts.py
        ├── transactions.py
        ├── projections.py
        └── prices.py

tests/               # Test suite
config/              # Configuration and migrations
```

## Getting Started

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Initialize Database

```bash
python -c "from src.data.database import init_db; init_db('sqlite:///./ledgera.db')"
```

### 3. Run Server

```bash
python -m src.api.main
```

API will be available at http://localhost:8000

### 4. Run Tests

```bash
pytest tests/
```

## API Endpoints

### Accounts
- `POST /api/v1/accounts` - Create account
- `GET /api/v1/accounts/{account_id}` - Get account
- `GET /api/v1/accounts` - List all accounts

### Transactions
- `POST /api/v1/transactions` - Create transaction
- `GET /api/v1/transactions/{transaction_id}` - Get transaction
- `GET /api/v1/transactions/account/{account_id}` - Get account transactions

### Projections
- `POST /api/v1/projections/forecast` - Generate projection
- `GET /api/v1/projections/scenarios` - List scenarios

### Prices
- `GET /api/v1/prices/fx/{base_ccy}/{quote_ccy}` - Get FX rate
- `GET /api/v1/prices/stock/{symbol}` - Get stock price

## Domain Model

### Double-Entry Accounting

Every transaction consists of 2+ postings (debit/credit pairs):

```python
Transaction:
  Posting 1: Account A, amount +100 SGD
  Posting 2: Account B, amount -100 SGD
```

### Projection Engine

Deterministic monthly roll-forward:

```
Gross Income (salary + bonus)
  - Taxes
  = Net Income
  - Expenses (with inflation)
  = Savings
  | Allocate to buckets by weight
  | Each bucket grows at expected return rate
  → Month-by-month forecast table
```

## Configuration

See `config/settings.py` for environment variables.

## Next Steps

- [ ] CloudKit sync adapter
- [ ] CSV import UI
- [ ] Reconciliation workflow
- [ ] Scenario comparison
- [ ] Stochastic projections (Monte Carlo)
- [ ] iOS app frontend
