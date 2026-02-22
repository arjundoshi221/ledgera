// ============================================================
// api.ts - Typed fetch wrapper for the Ledgera FastAPI backend
// ============================================================

import { getToken } from "./auth"
import type {
  AuthResponse,
  SignupRequest,
  LoginRequest,
  GoogleLoginRequest,
  CompleteProfileRequest,
  UserResponse,
  Account,
  AccountType,
  CreateAccountRequest,
  Transaction,
  CreateTransactionRequest,
  CreateTransferRequest,
  ProjectionAssumptions,
  ProjectionResponse,
  Workspace,
  UpdateWorkspaceRequest,
  PriceResponse,
  Category,
  CreateCategoryRequest,
  Subcategory,
  CreateSubcategoryRequest,
  Fund,
  CreateFundRequest,
  MonthlyExpenseSplit,
  MonthlyIncomeSplit,
  IncomeAllocationResponse,
  FundAllocationOverride,
  CreateFundAllocationOverrideRequest,
  Scenario,
  ScenarioListItem,
  SaveScenarioRequest,
  FundTrackerResponse,
  MonthlyDashboardResponse,
  NetWorthResponse,
  Card,
  CreateCardRequest,
  PaymentMethod,
  CreatePaymentMethodRequest,
  RecurringTransaction,
  CreateRecurringTransactionRequest,
  PendingInstance,
  ConfirmRecurringRequest,
  SkipRecurringRequest,
} from "./types"

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ---------------------
// Base fetcher
// ---------------------

class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    const message =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `API error ${status}`
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

export { ApiError }

/**
 * Core fetch helper that prepends the base URL, attaches the Bearer token
 * (when available), and returns parsed JSON typed as T.
 */
async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = await response.text()
    }
    throw new ApiError(response.status, body)
  }

  return response.json() as Promise<T>
}

// ---------------------
// Auth
// ---------------------

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getMe(): Promise<UserResponse> {
  return apiFetch<UserResponse>("/auth/me")
}

export async function googleLogin(data: GoogleLoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function completeProfile(data: CompleteProfileRequest): Promise<UserResponse> {
  return apiFetch<UserResponse>("/auth/complete-profile", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// ---------------------
// Accounts
// ---------------------

export async function getAccounts(): Promise<Account[]> {
  const raw = await apiFetch<
    Array<{
      id: string
      name: string
      account_type: string
      currency: string
      starting_balance: number
      institution: string | null
      workspace_id: string
    }>
  >("/api/v1/accounts")

  return raw.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.account_type as AccountType,
    account_currency: a.currency,
    institution: a.institution,
    starting_balance: a.starting_balance ?? 0,
    workspace_id: a.workspace_id,
  }))
}

export async function createAccount(
  data: CreateAccountRequest
): Promise<Account> {
  // Transform frontend schema to backend schema
  const payload = {
    name: data.name,
    account_type: data.type,
    currency: data.account_currency,
    institution: data.institution,
    starting_balance: data.starting_balance ?? 0,
  }

  const raw = await apiFetch<{
    id: string
    name: string
    account_type: string
    currency: string
    starting_balance: number
    institution: string | null
  }>("/api/v1/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  // Transform backend response to frontend schema
  return {
    id: raw.id,
    name: raw.name,
    type: raw.account_type as AccountType,
    account_currency: raw.currency,
    institution: raw.institution,
    starting_balance: raw.starting_balance,
    workspace_id: "",
  }
}

export async function updateAccount(
  accountId: string,
  data: CreateAccountRequest
): Promise<Account> {
  const payload = {
    name: data.name,
    account_type: data.type,
    currency: data.account_currency,
    institution: data.institution,
    starting_balance: data.starting_balance ?? 0,
  }

  const raw = await apiFetch<{
    id: string
    name: string
    account_type: string
    currency: string
    starting_balance: number
    institution: string | null
  }>(`/api/v1/accounts/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })

  return {
    id: raw.id,
    name: raw.name,
    type: raw.account_type as AccountType,
    account_currency: raw.currency,
    institution: raw.institution,
    starting_balance: raw.starting_balance ?? 0,
    workspace_id: "",
  }
}

export async function deleteAccount(accountId: string): Promise<void> {
  await apiFetch(`/api/v1/accounts/${accountId}`, {
    method: "DELETE",
  })
}

// ---------------------
// Transactions
// ---------------------

export async function getTransactions(
  accountId?: string
): Promise<Transaction[]> {
  if (accountId) {
    return apiFetch<Transaction[]>(`/api/v1/transactions/account/${accountId}`)
  }
  return apiFetch<Transaction[]>(`/api/v1/transactions`)
}

export async function createTransaction(
  data: CreateTransactionRequest
): Promise<Transaction> {
  const payload = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  }
  return apiFetch<Transaction>("/api/v1/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function createTransfer(
  data: CreateTransferRequest
): Promise<Transaction> {
  const payload = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  }
  return apiFetch<Transaction>("/api/v1/transactions/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateTransaction(
  transactionId: string,
  data: CreateTransactionRequest
): Promise<Transaction> {
  const payload = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  }
  return apiFetch<Transaction>(`/api/v1/transactions/${transactionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  await apiFetch(`/api/v1/transactions/${transactionId}`, {
    method: "DELETE",
  })
}

// ---------------------
// Projections
// ---------------------

export async function runProjection(
  assumptions: ProjectionAssumptions,
  months?: number
): Promise<ProjectionResponse> {
  const params = months !== undefined ? `?months=${months}` : ""
  const raw = await apiFetch<{ scenario_id: string; months: any[] }>(`/api/v1/projections/forecast${params}`, {
    method: "POST",
    body: JSON.stringify(assumptions),
  })
  return {
    scenario_id: raw.scenario_id,
    assumptions,
    projections: raw.months,
  }
}

// ---------------------
// Scenarios (Saved Simulations)
// ---------------------

export async function getScenarios(): Promise<ScenarioListItem[]> {
  return apiFetch<ScenarioListItem[]>("/api/v1/projections/scenarios")
}

export async function getScenario(scenarioId: string): Promise<Scenario> {
  return apiFetch<Scenario>(`/api/v1/projections/scenarios/${scenarioId}`)
}

export async function getActiveScenario(): Promise<Scenario | null> {
  try {
    return await apiFetch<Scenario>("/api/v1/projections/scenarios/active")
  } catch {
    return null
  }
}

export async function saveScenario(data: SaveScenarioRequest): Promise<Scenario> {
  return apiFetch<Scenario>("/api/v1/projections/scenarios", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateScenario(id: string, data: SaveScenarioRequest): Promise<Scenario> {
  return apiFetch<Scenario>(`/api/v1/projections/scenarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function activateScenario(id: string): Promise<ScenarioListItem> {
  return apiFetch<ScenarioListItem>(`/api/v1/projections/scenarios/${id}/activate`, {
    method: "PATCH",
  })
}

export async function deleteScenario(id: string): Promise<void> {
  await apiFetch(`/api/v1/projections/scenarios/${id}`, { method: "DELETE" })
}

// ---------------------
// Workspace
// ---------------------

export async function getWorkspace(): Promise<Workspace> {
  return apiFetch<Workspace>("/api/v1/workspace")
}

export async function updateWorkspace(
  data: UpdateWorkspaceRequest
): Promise<Workspace> {
  return apiFetch<Workspace>("/api/v1/workspace", {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

// ---------------------
// Prices
// ---------------------

export async function getPrice(
  base: string,
  quote: string
): Promise<PriceResponse> {
  const raw = await apiFetch<{ base_ccy: string; quote_ccy: string; rate: number; source: string; timestamp: string }>(
    `/api/v1/prices/fx/${base}/${quote}`
  )
  return {
    base: raw.base_ccy,
    quote: raw.quote_ccy,
    rate: raw.rate,
    source: raw.source,
    timestamp: raw.timestamp,
  }
}

// ---------------------
// Categories
// ---------------------

export async function getCategories(type?: "expense" | "income"): Promise<Category[]> {
  const params = type ? `?category_type=${type}` : ""
  return apiFetch<Category[]>(`/api/v1/categories${params}`)
}

export async function createCategory(data: CreateCategoryRequest): Promise<Category> {
  return apiFetch<Category>("/api/v1/categories", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateCategory(categoryId: string, data: CreateCategoryRequest): Promise<Category> {
  return apiFetch<Category>(`/api/v1/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await apiFetch(`/api/v1/categories/${categoryId}`, { method: "DELETE" })
}

// ---------------------
// Subcategories
// ---------------------

export async function getSubcategories(categoryId?: string): Promise<Subcategory[]> {
  const params = categoryId ? `?category_id=${categoryId}` : ""
  return apiFetch<Subcategory[]>(`/api/v1/categories/subcategories${params}`)
}

export async function createSubcategory(data: CreateSubcategoryRequest): Promise<Subcategory> {
  return apiFetch<Subcategory>("/api/v1/categories/subcategories", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateSubcategory(subcategoryId: string, data: CreateSubcategoryRequest): Promise<Subcategory> {
  return apiFetch<Subcategory>(`/api/v1/categories/subcategories/${subcategoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteSubcategory(subcategoryId: string): Promise<void> {
  await apiFetch(`/api/v1/categories/subcategories/${subcategoryId}`, { method: "DELETE" })
}

// ---------------------
// Funds
// ---------------------

export async function getFunds(): Promise<Fund[]> {
  return apiFetch<Fund[]>("/api/v1/categories/funds")
}

export async function createFund(data: CreateFundRequest): Promise<Fund> {
  return apiFetch<Fund>("/api/v1/categories/funds", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateFund(fundId: string, data: CreateFundRequest): Promise<Fund> {
  return apiFetch<Fund>(`/api/v1/categories/funds/${fundId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteFund(fundId: string): Promise<void> {
  await apiFetch(`/api/v1/categories/funds/${fundId}`, { method: "DELETE" })
}

// ---------------------
// Analytics
// ---------------------

export async function getExpenseSplit(year: number, month: number): Promise<MonthlyExpenseSplit> {
  return apiFetch<MonthlyExpenseSplit>(`/api/v1/analytics/expense-split?year=${year}&month=${month}`)
}

export async function getIncomeSplit(year: number, month: number): Promise<MonthlyIncomeSplit> {
  return apiFetch<MonthlyIncomeSplit>(`/api/v1/analytics/income-split?year=${year}&month=${month}`)
}

export async function getIncomeAllocation(years: number = 1): Promise<IncomeAllocationResponse> {
  return apiFetch<IncomeAllocationResponse>(`/api/v1/analytics/income-allocation?years=${years}`)
}

// ---------------------
// Fund Allocation Overrides
// ---------------------

export async function createOrUpdateAllocationOverride(
  data: CreateFundAllocationOverrideRequest
): Promise<FundAllocationOverride> {
  return apiFetch<FundAllocationOverride>("/api/v1/analytics/fund-allocation-overrides", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getAllocationOverrides(
  year?: number,
  month?: number
): Promise<FundAllocationOverride[]> {
  const params = year && month ? `?year=${year}&month=${month}` : ""
  return apiFetch<FundAllocationOverride[]>(`/api/v1/analytics/fund-allocation-overrides${params}`)
}

export async function deleteAllocationOverride(
  fundId: string,
  year: number,
  month: number
): Promise<void> {
  await apiFetch(`/api/v1/analytics/fund-allocation-overrides/${fundId}/${year}/${month}`, {
    method: "DELETE",
  })
}

// ---------------------
// Fund Tracker
// ---------------------

export async function getFundTracker(years: number = 1): Promise<FundTrackerResponse> {
  return apiFetch<FundTrackerResponse>(`/api/v1/analytics/fund-tracker?years=${years}`)
}

// ---------------------
// Monthly Dashboard
// ---------------------

export async function getMonthlyDashboard(year: number, month: number): Promise<MonthlyDashboardResponse> {
  return apiFetch<MonthlyDashboardResponse>(`/api/v1/analytics/monthly-dashboard?year=${year}&month=${month}`)
}

// ---------------------
// Net Worth / Portfolio
// ---------------------

export async function getNetWorth(years: number = 1): Promise<NetWorthResponse> {
  return apiFetch<NetWorthResponse>(`/api/v1/analytics/net-worth?years=${years}`)
}

// ---------------------
// Cards
// ---------------------

export async function getCards(): Promise<Card[]> {
  return apiFetch<Card[]>("/api/v1/payments/cards")
}

export async function createCard(data: CreateCardRequest): Promise<Card> {
  return apiFetch<Card>("/api/v1/payments/cards", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateCard(cardId: string, data: CreateCardRequest): Promise<Card> {
  return apiFetch<Card>(`/api/v1/payments/cards/${cardId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteCard(cardId: string): Promise<void> {
  await apiFetch(`/api/v1/payments/cards/${cardId}`, { method: "DELETE" })
}

// ---------------------
// Payment Methods
// ---------------------

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return apiFetch<PaymentMethod[]>("/api/v1/payments/methods")
}

export async function createPaymentMethod(data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>("/api/v1/payments/methods", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updatePaymentMethod(methodId: string, data: CreatePaymentMethodRequest): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>(`/api/v1/payments/methods/${methodId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deletePaymentMethod(methodId: string): Promise<void> {
  await apiFetch(`/api/v1/payments/methods/${methodId}`, { method: "DELETE" })
}

// ---------------------
// Recurring Transactions
// ---------------------

export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  return apiFetch<RecurringTransaction[]>("/api/v1/recurring")
}

export async function createRecurringTransaction(
  data: CreateRecurringTransactionRequest
): Promise<RecurringTransaction> {
  return apiFetch<RecurringTransaction>("/api/v1/recurring", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateRecurringTransaction(
  id: string,
  data: Partial<CreateRecurringTransactionRequest> & { is_active?: boolean }
): Promise<RecurringTransaction> {
  return apiFetch<RecurringTransaction>(`/api/v1/recurring/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function deleteRecurringTransaction(id: string): Promise<void> {
  await apiFetch(`/api/v1/recurring/${id}`, { method: "DELETE" })
}

export async function getPendingInstances(): Promise<PendingInstance[]> {
  return apiFetch<PendingInstance[]>("/api/v1/recurring/pending")
}

export async function confirmRecurring(
  recurringId: string,
  data: ConfirmRecurringRequest
): Promise<{ transaction: unknown; next_occurrence: string | null }> {
  return apiFetch(`/api/v1/recurring/${recurringId}/confirm`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function skipRecurring(
  recurringId: string,
  data: SkipRecurringRequest
): Promise<{ message: string; next_occurrence: string | null }> {
  return apiFetch(`/api/v1/recurring/${recurringId}/skip`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}
