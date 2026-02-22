// ============================================================
// types.ts - TypeScript interfaces mirroring FastAPI backend schemas
// ============================================================

// ---------------------
// Auth
// ---------------------

export interface SignupRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  date_of_birth: string
  nationalities: string[]
  tax_residencies: string[]
  countries_of_interest: string[]
  phone_country_code: string
  phone_number: string
  address_line1: string
  address_line2: string
  address_city: string
  address_state: string
  address_postal_code: string
  address_country: string
  tax_id_number: string
  is_us_person: boolean
  tos_accepted: boolean
  privacy_accepted: boolean
  base_currency?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user_id: string
  workspace_id: string
  profile_completed: boolean
  is_admin: boolean
}

export interface GoogleLoginRequest {
  access_token: string
}

export interface CompleteProfileRequest {
  first_name?: string
  last_name?: string
  date_of_birth: string
  nationalities: string[]
  tax_residencies: string[]
  countries_of_interest: string[]
  phone_country_code: string
  phone_number: string
  address_line1: string
  address_line2: string
  address_city: string
  address_state: string
  address_postal_code: string
  address_country: string
  tax_id_number: string
  is_us_person: boolean
  tos_accepted: boolean
  privacy_accepted: boolean
  base_currency?: string
}

export interface UserResponse {
  id: string
  email: string
  first_name: string
  last_name: string
  workspace_id: string
  date_of_birth: string | null
  nationalities: string[]
  tax_residencies: string[]
  countries_of_interest: string[]
  phone_country_code: string | null
  phone_number: string | null
  address_line1: string | null
  address_line2: string | null
  address_city: string | null
  address_state: string | null
  address_postal_code: string | null
  address_country: string | null
  tax_id_number: string | null
  is_us_person: boolean
  tos_accepted_at: string | null
  privacy_accepted_at: string | null
  tos_version: string | null
  profile_completed: boolean
  auth_provider: string
}

// ---------------------
// Accounts
// ---------------------

export type AccountType = "asset" | "liability"

export interface Account {
  id: string
  name: string
  type: AccountType
  account_currency: string
  institution: string | null
  starting_balance: number
  workspace_id: string
}

export interface CreateAccountRequest {
  name: string
  type: AccountType
  account_currency: string
  institution?: string
  starting_balance?: number
}

// ---------------------
// Transactions
// ---------------------

export interface Posting {
  account_id: string
  amount: number
  currency: string
  fx_rate: number
}

export interface Transaction {
  id: string
  timestamp: string
  payee: string
  memo: string
  status: string
  type: string | null
  category_id: string | null
  subcategory_id: string | null
  fund_id: string | null
  source_fund_id: string | null
  dest_fund_id: string | null
  payment_method_id: string | null
  postings: Posting[]
}

export interface CreateTransactionRequest {
  timestamp?: string
  payee: string
  memo: string
  status?: string
  category_id?: string
  subcategory_id?: string
  fund_id?: string
  payment_method_id?: string
  postings: Posting[]
}

// ---------------------
// Projections
// ---------------------

export interface SubcategoryBudget {
  subcategory_id: string
  monthly_amount: number
  inflation_override?: number
}

export interface CategoryBudget {
  category_id: string
  monthly_amount: number
  inflation_override?: number
  subcategory_budgets?: SubcategoryBudget[]
}

export interface OneTimeCost {
  name: string
  amount: number
  month_index: number
  notes?: string
  category_id?: string
}

export interface FXMapping {
  base_currency: string
  display_currencies: string[]
  rates: Record<string, number>
}

export interface ProjectionAssumptions {
  base_currency: string
  start_date?: string
  monthly_salary: number
  annual_bonus: number
  tax_rate: number
  other_income?: number

  // Category-based expenses (preferred)
  category_budgets?: CategoryBudget[]
  expense_inflation_rate: number

  // Legacy flat expenses (deprecated but still supported)
  monthly_expenses?: number

  // One-time costs
  one_time_costs?: OneTimeCost[]

  // Fund allocations
  allocation_weights: Record<string, number>
  bucket_returns: Record<string, number>

  // Cash buffer rules
  minimum_cash_buffer_months?: number
  cash_buffer_bucket_name?: string
  enforce_cash_buffer?: boolean

  // Multi-currency display (optional)
  fx_mapping?: FXMapping
}

export interface MonthlyProjection {
  period: string
  gross_income: number
  taxes: number
  net_income: number
  expenses: number
  expense_breakdown?: Record<string, number>
  one_time_costs?: number
  one_time_costs_detail?: Array<{
    name: string
    amount: number
    notes?: string
    category_id?: string
  }>
  savings: number
  savings_rate: number
  bucket_allocations: Record<string, number>
  bucket_balances: Record<string, number>
  net_income_fx?: Record<string, number>
  total_wealth_fx?: Record<string, number>
}

export interface YearlyProjection {
  year: number
  gross_income: number
  taxes: number
  net_income: number
  expenses: number
  one_time_costs: number
  savings: number
  avg_savings_rate: number
  bucket_balances_start: Record<string, number>
  bucket_balances_end: Record<string, number>
  bucket_contributions: Record<string, number>
  total_wealth_end: number
}

export interface ProjectionResponse {
  scenario_id: string
  assumptions: ProjectionAssumptions
  projections: MonthlyProjection[]
}

// ---------------------
// Scenarios (Saved Simulations)
// ---------------------

export interface Scenario {
  id: string
  name: string
  description: string | null
  assumptions: ProjectionAssumptions
  monthly_expenses_total: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ScenarioListItem {
  id: string
  name: string
  description: string | null
  monthly_expenses_total: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SaveScenarioRequest {
  name: string
  description?: string
  assumptions: ProjectionAssumptions
  is_active?: boolean
}

// ---------------------
// Workspace
// ---------------------

export interface Workspace {
  id: string
  name: string
  base_currency: string
}

export interface UpdateWorkspaceRequest {
  name?: string
  base_currency?: string
}

// ---------------------
// Prices
// ---------------------

export interface PriceResponse {
  base: string
  quote: string
  rate: number
  source: string
  timestamp: string
}
// ---------------------
// Categories
// ---------------------

export interface Category {
  id: string
  name: string
  emoji: string | null
  type: "expense" | "income"
  description: string | null
  is_system: boolean
  created_at: string
}

export interface CreateCategoryRequest {
  name: string
  emoji?: string
  type: "expense" | "income"
  description?: string
}

// ---------------------
// Subcategories
// ---------------------

export interface Subcategory {
  id: string
  category_id: string
  name: string
  description: string | null
  created_at: string
}

export interface CreateSubcategoryRequest {
  category_id: string
  name: string
  description?: string
}

// ---------------------
// Funds
// ---------------------

export interface LinkedAccountSummary {
  id: string
  name: string
  institution: string | null
  account_currency: string
  allocation_percentage: number
}

export interface Fund {
  id: string
  name: string
  emoji: string | null
  description: string | null
  allocation_percentage: number
  is_active: boolean
  is_system: boolean
  created_at: string
  linked_accounts: LinkedAccountSummary[]
}

export interface FundAccountAllocation {
  account_id: string
  allocation_percentage: number
}

export interface CreateFundRequest {
  name: string
  emoji?: string
  description?: string
  allocation_percentage?: number
  account_ids?: string[]
  account_allocations?: FundAccountAllocation[]
}

// ---------------------
// Analytics
// ---------------------

export interface SubcategorySplit {
  subcategory_id: string | null
  subcategory_name: string
  total_amount: number
  transaction_count: number
}

export interface CategorySplit {
  category_id: string
  category_name: string
  emoji: string
  total_amount: number
  transaction_count: number
  subcategories: SubcategorySplit[]
}

export interface MonthlyExpenseSplit {
  year: number
  month: number
  total_expenses: number
  categories: CategorySplit[]
}

export interface FundAllocation {
  fund_id: string
  fund_name: string
  emoji: string
  allocation_percentage: number
  allocated_amount: number
  is_auto?: boolean
}

export interface IncomeAllocationRow {
  year: number
  month: number
  net_income: number
  allocated_fixed_cost: number
  actual_fixed_cost: number
  fixed_cost_optimization: number
  savings_remainder: number
  fund_allocations: FundAllocation[]
  is_locked: boolean
  working_capital_pct_of_income: number
  savings_pct_of_income: number
  total_fund_allocation_pct: number
}

export interface IncomeAllocationResponse {
  rows: IncomeAllocationRow[]
  funds_meta: Array<{ fund_id: string; fund_name: string; emoji: string; linked_account_names: string[] }>
  active_scenario_name: string | null
  active_scenario_id: string | null
  budget_benchmark: number
}

// Keep for backward compat with expense-split
export interface MonthlyIncomeSplit {
  year: number
  month: number
  total_income: number
  funds: FundAllocation[]
}

export interface FundAllocationOverride {
  id: string
  fund_id: string
  year: number
  month: number
  allocation_percentage: number
  created_at: string
  updated_at: string
}

export interface CreateFundAllocationOverrideRequest {
  fund_id: string
  year: number
  month: number
  allocation_percentage: number
}

// ---------------------
// Fund Tracker
// ---------------------

export interface FundChargeDetail {
  category_name: string
  category_emoji: string
  amount: number
}

export interface FundMonthlyLedgerRow {
  year: number
  month: number
  opening_balance: number
  contribution: number
  actual_credits: number
  actual_debits: number
  charge_details: FundChargeDetail[]
  fund_income: number
  closing_balance: number
}

export interface FundLedger {
  fund_id: string
  fund_name: string
  emoji: string
  linked_accounts: LinkedAccountSummary[]
  months: FundMonthlyLedgerRow[]
  total_contributions: number
  total_fund_income: number
  current_balance: number
}

export interface AccountTrackerRow {
  account_id: string
  account_name: string
  institution: string | null
  account_currency: string
  starting_balance: number
  expected_contributions: number
  actual_balance: number
  difference: number
  prev_month_balance: number
  current_month_expected: number
  current_month_difference: number
  // Native currency / mark-to-market fields
  native_balance: number
  current_fx_rate: number
  market_value_base: number
  cost_basis_base: number
  unrealized_fx_gain: number
}

export interface TransferSuggestion {
  from_account_name: string
  from_account_id: string
  from_currency: string
  to_account_name: string
  to_account_id: string
  to_currency: string
  amount: number
  currency: string
  source_fund_id: string | null
  dest_fund_id: string | null
}

export interface CreateTransferRequest {
  timestamp?: string
  payee?: string
  memo?: string
  from_account_id: string
  to_account_id: string
  amount: number
  from_currency?: string
  to_currency?: string
  fx_rate?: number
  source_fund_id?: string
  dest_fund_id?: string
  payment_method_id?: string
  fee?: number
  fee_category_id?: string
}

export interface WCOptimization {
  wc_balance: number
  threshold: number
  surplus: number
}

export interface FundTrackerSummary {
  total_expected: number
  total_actual: number
  total_difference: number
  ytd_contributions: number
  ytd_fund_income: number
  ytd_wc_surplus: number
  unallocated_remainder: number
  transfer_suggestions: TransferSuggestion[]
  wc_optimization: WCOptimization | null
}

export interface FundTrackerResponse {
  fund_ledgers: FundLedger[]
  account_summaries: AccountTrackerRow[]
  summary: FundTrackerSummary
}

// ---------------------
// Monthly Dashboard
// ---------------------

export interface FundCategoryAnalysis {
  category_id: string | null
  category_name: string
  category_emoji: string
  amount_spent: number
  budget_allocated: number
}

export interface FundDashboardAnalysis {
  fund_id: string
  fund_name: string
  fund_emoji: string
  is_working_capital: boolean
  total_spent: number
  total_budget: number
  fund_balance: number
  categories: FundCategoryAnalysis[]
}

export interface FundExtractionItem {
  fund_id: string
  fund_name: string
  fund_emoji: string
  percentage: number
  amount: number
}

export interface MonthlyDashboardResponse {
  year: number
  month: number
  currency: string
  fund_analyses: FundDashboardAnalysis[]
  fund_extraction: FundExtractionItem[]
}

// ---------------------
// Net Worth / Portfolio
// ---------------------

export interface AccountNetWorthRow {
  account_id: string
  account_name: string
  institution: string | null
  account_currency: string
  account_type: string
  native_balance: number
  fx_rate_to_base: number
  base_value: number
  cost_basis: number
  unrealized_fx_gain: number
}

export interface CurrencyBreakdown {
  currency: string
  total_native: number
  base_equivalent: number
  percentage: number
}

export interface NetWorthHistoryPoint {
  year: number
  month: number
  net_worth: number
  assets: number
  liabilities: number
}

export interface NetWorthResponse {
  base_currency: string
  total_net_worth: number
  total_assets: number
  total_liabilities: number
  total_unrealized_fx_gain: number
  accounts: AccountNetWorthRow[]
  currency_breakdown: CurrencyBreakdown[]
  history: NetWorthHistoryPoint[]
  fx_rates_used: Record<string, number>
}

// ---------------------
// Cards
// ---------------------

export interface Card {
  id: string
  account_id: string
  card_name: string
  card_type: "credit" | "debit"
  card_network: string | null
  last_four: string | null
  is_active: boolean
  payment_method_id: string | null
  created_at: string
}

export interface CreateCardRequest {
  account_id: string
  card_name: string
  card_type: "credit" | "debit"
  card_network?: string
  last_four?: string
}

// ---------------------
// Payment Methods
// ---------------------

export type PaymentMethodType = "cash" | "bank_transfer" | "card" | "digital_wallet" | "custom"

export interface PaymentMethod {
  id: string
  name: string
  method_type: PaymentMethodType
  icon: string | null
  card_id: string | null
  linked_account_id: string | null
  is_system: boolean
  is_active: boolean
  created_at: string
}

export interface CreatePaymentMethodRequest {
  name: string
  method_type: PaymentMethodType
  icon?: string
  linked_account_id?: string
}

// ---------------------
// Recurring Transactions
// ---------------------

export type RecurringFrequency = "daily" | "weekly" | "bi_weekly" | "monthly" | "quarterly" | "yearly"
export type RecurringTransactionType = "income" | "expense" | "transfer"

export interface RecurringTransaction {
  id: string
  name: string
  transaction_type: RecurringTransactionType
  payee: string | null
  memo: string | null
  amount: number
  currency: string
  category_id: string | null
  subcategory_id: string | null
  fund_id: string | null
  payment_method_id: string | null
  account_id: string | null
  from_account_id: string | null
  to_account_id: string | null
  from_currency: string | null
  to_currency: string | null
  fx_rate: number | null
  source_fund_id: string | null
  dest_fund_id: string | null
  transfer_fee: number | null
  fee_category_id: string | null
  frequency: RecurringFrequency
  start_date: string
  end_date: string | null
  next_occurrence: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateRecurringTransactionRequest {
  name: string
  transaction_type: RecurringTransactionType
  payee?: string
  memo?: string
  amount: number
  currency?: string
  category_id?: string
  subcategory_id?: string
  fund_id?: string
  payment_method_id?: string
  account_id?: string
  from_account_id?: string
  to_account_id?: string
  from_currency?: string
  to_currency?: string
  fx_rate?: number
  source_fund_id?: string
  dest_fund_id?: string
  transfer_fee?: number
  fee_category_id?: string
  frequency: RecurringFrequency
  start_date: string
  end_date?: string
}

export interface PendingInstance {
  recurring_id: string
  name: string
  transaction_type: RecurringTransactionType
  occurrence_date: string
  payee: string | null
  memo: string | null
  amount: number
  currency: string
  category_id: string | null
  subcategory_id: string | null
  fund_id: string | null
  payment_method_id: string | null
  account_id: string | null
  from_account_id: string | null
  to_account_id: string | null
  from_currency: string | null
  to_currency: string | null
  fx_rate: number | null
  source_fund_id: string | null
  dest_fund_id: string | null
  transfer_fee: number | null
  fee_category_id: string | null
  frequency: RecurringFrequency
}

export interface ConfirmRecurringRequest {
  occurrence_date: string
  amount_override?: number
  payee_override?: string
  memo_override?: string
}

export interface SkipRecurringRequest {
  occurrence_date: string
}