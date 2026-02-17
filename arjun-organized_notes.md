## How to run (current)

**Backend**

```bash
conda activate "c:/Users/arjd2/Documents/GitHub/ledgera/.conda"
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**

```powershell
.\.nodeenv\Scripts\Activate.ps1
cd frontend
npm run dev
```

---

## Current navigation (from your screenshot)

* Dashboard
* Accounts
* Transactions
* Expense Split
* Income Allocation
* Projections
* Settings

You also want **new tabs later** (not part of the current nav cleanup), e.g. **Fund & Account Tracker**, Admin Panel, etc.

---

# Core product rules (global logic you want)

These are cross-cutting behaviors that multiple pages must obey.

## 1) “Model → Allocation → Transfers” must be consistent

* The **Income Allocation** page should **not invent** numbers.
* **Working Capital budget** is **derived from the model** and must be **auto-calculated**.
* If you optimize (change allocation %), the **absolute $ amounts** sent to accounts/funds for *the current month* should update, and **nothing else** should drift.

## 2) No forward-looking views where not needed

* On **Income Allocation**, you only want **up to the current month**.
* No “full year future allocation table” there.

## 3) Simulation snapshots are immutable once a month is closed

You want “lock forever” for prior months:

* When you run a new simulation today:

  * It should **start from now** (current month onward).
  * **Past months remain frozen** (both allocation outputs and the implied working capital).
* Practically: the system needs **month-level snapshotting**:

  * `SimulationVersion` (the new run)
  * `MonthlyAllocationSnapshot` (immutable records per month)
  * Rules: snapshots for months `< current_month` are read-only and never recomputed.

---

# Page-by-page requirements (existing tabs)

## 1) Dashboard (needs rebuild: “proper monthly dashboard”)

**Goal:** a clean monthly operating view.

**Should show (MVP):**

* Month selector (default = current month)
* Income received (actuals from transactions tagged as income)
* Allocated amounts (from the locked monthly snapshot)
* Actual spending vs budget (from Expense Split + Transactions)
* Working capital (model-derived; current month value)
* Quick alerts:

  * “Over/under allocated”
  * “Missing expected transfers”
  * “Spending exceeds category budget”

**Later enhancement:** “modeled net worth vs accounting net worth” comparison.

---

## 2) Accounts (allow start balances / import balances)

**MVP requirements:**

* Add **Start Balance** per account (at account creation or via import).
* Support **import balance** (manual CSV import or simple input) as a special “balance adjustment” transaction type.
* Base currency per account remains selectable (you already said this earlier).

**Important rule:** account balances must be explainable as:
$$\text{Balance}*{t}=\text{StartBalance}+\sum \text{Transactions}*{\le t}$$

---

## 3) Transactions (test with dummy transactions)

**MVP requirements:**

* Ability to create dummy transactions fast.
* Each transaction should be taggable with:

  * Category (existing)
  * **Account** (where it physically sits)
  * (Later) **Fund** (logical bucket)
* Support transaction types:

  * income
  * expense
  * transfer (account→account)
  * adjustment (for start balance/import reconciliation)

**Testing checklist (minimum):**

* Balance updates correctly per account after each transaction
* Transfers do not change net worth, only move location
* Income/expense affects net worth

---

## 4) Expense Split

**Goal:** budget tracking by category.

**MVP:**

* Category-wise budgets for the month (either fixed or derived from model)
* Actuals rollup from transactions
* Variance view:

  * budget
  * actual
  * remaining

**Later:** exportable monthly statement pack.

---

## 5) Income Allocation (your most immediate changes)

### What it should do

* For **current month only** (and optionally show history up to current month):

  * Total income for the month (from model or actual, depending on your chosen mode)
  * Allocation % by destination (funds/accounts/categories)
  * Computed $ amounts to allocate
  * **Working Capital = auto-calculated** from the model and shown as an output, not a free input

### Optimization behavior

* Changing % allocations updates:

  * **current month allocated $ amounts**
  * the **recommended transfers** for current month
* It must **not rewrite past months**.

### History behavior

* Past months are displayed from locked snapshots:

  * read-only
  * consistent forever

---

## 6) Projections

You already have projections modeling; tie it into allocations cleanly:

**MVP expectation:**

* Projections produce the numbers that feed:

  * working capital
  * planned contributions
  * planned budgets

**Key constraint:** projections can be recomputed freely, but once a month closes, allocation outputs for that month are frozen.

---

## 7) Settings

**MVP:**

* Family/admin scaffolding later; for now keep:

  * currencies / FX source toggle (manual vs API later)
  * simulation defaults
  * export settings (later PDF)

---

# New tabs (future — but define clearly now)

## A) Fund & Account Tracker (highest priority new tab)

This is the “true accounting logic” you described.

### Definitions (your intended semantics)

* **Funds** = planning/allocation buckets (what you *intend* money to be used for)
* **Accounts** = where money *physically sits* (bank/brokerage wallets)
* Transactions are tagged with **both**:

  * Fund (logical)
  * Account (physical)

### What the tab must show

**Fund views**

* Target balance (from allocation plan / monthly snapshots)
* Actual balance (computed from transactions tagged to that fund)
* Contribution history (monthly)
* Fund income attribution:

  * dividends, interest, etc. credited into the fund
  * fund return estimate can be computed from actuals (later)
* End-of-year export:

  * contributions
  * withdrawals
  * income
  * (optional) returns estimate

**Account views**

* Expected balance (based on planned transfers/contributions)
* Actual balance (from ledger)
* “Initiate transfer” actions when there’s a gap

### Weekly check (automated reconciliation logic)

* Once a week:

  * compute **expected vs actual** for each fund and account
  * alert if deviation exceeds threshold
* Important: this check is **contribution-based**, not “market return-based”.

---

## B) Family / multi-user plan (8 users)

**Access model you want:**

* Each person has their own login
* Family admin can view consolidated accounts/funds
* Max 8 users

**Security constraint you stated:**

* Password encryption such that admin cannot view passwords.

---

## C) Full Admin Panel + analytics

* User management
* Marketing / product analytics

---

## D) Goal setter

* Define goals (e.g., “Emergency fund = $X by date”)
* Tie to funds + monthly contributions
* Track progress

---

# Exports & reporting you want (future but should be designed in now)

## 1) Monthly analysis page

* This month budgets
* Credit/debit statements subpage (bank-statement-like)
* Export to **PDF**
* Export “month pack” with:

  * category budgets vs actuals
  * account statement summary
  * fund contribution summary
  * FX summary used for month

## 2) Live net worth

* Accounting net worth (ledger-based)
* Modeled net worth (simulation-based default plan)
* Variance and attribution

## 3) FX rates

* API-link exchange rate
* Store a **unique monthly FX rate** per currency pair used in reports

  * (e.g., month-average, month-end, or your chosen convention—store the convention too)

---

# Bank integrations (later)

* Bank / credit card integrations
* Travel accounting mode (trip-specific category layer)

---

# “Quicken-like” positioning

What you’re describing maps to:

* double-entry-ish ledger behavior (accounts + transfers)
* budgeting + envelopes (funds)
* month close + immutable history (very important)

---

# Aditi’s requested inputs (captured cleanly)

1. Inflation as a function of data
2. Tax brackets for countries
3. Bonus as % or absolute
4. Base templates
5. Change/increase in bonus % over time
6. Simulation benchmarks for funds related to investments

---

## Suggested priority order (so implementation matches your intent)

1. **Income Allocation fixes**: auto working capital, current-month only, locked prior months
2. **Accounts start balance / import balance** + transaction types (transfer/adjustment)
3. **Dashboard (monthly)** using real transactions + locked allocation snapshot
4. **Dummy transaction testing harness** (fast data entry + scenarios)
5. **Fund & Account Tracker tab** (core accounting + planned vs actual + exports later)

If you want, I can translate this into:

* a **data model sketch** (tables/entities + invariants), and
* a **page contract spec** (inputs/outputs per page + what recomputes vs what is immutable).
