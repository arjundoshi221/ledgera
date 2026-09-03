// ============================================================
// hooks.ts - SWR hooks for client-side caching with revalidation
// ============================================================

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import type { SWRConfiguration } from 'swr'
import * as api from './api'
import { clearCacheOnLogout } from './cache'
import * as adminApi from './admin-api'
import type {
  Account,
  Transaction,
  Category,
  Subcategory,
  Fund,
  Workspace,
  MonthlyExpenseSplit,
  MonthlyIncomeSplit,
  IncomeAllocationResponse,
  FundAllocationOverride,
  FundTrackerResponse,
  MonthlyDashboardResponse,
  NetWorthResponse,
  Card,
  PaymentMethod,
  RecurringTransaction,
  PendingInstance,
  ScenarioListItem,
  Scenario,
  PriceResponse,
  UserResponse,
} from './types'
import type {
  SystemStats,
  TimeSeriesPoint,
} from './admin-types'

// ============================================================
// Global SWR Configuration
// ============================================================

// Base config. `revalidateOnFocus` is off by default because focus events on the
// dashboard were kicking off 8+ parallel refetches; the ETag pipeline (B5) makes
// revalidation cheap on the wire but the CPU/render cost still hurts. Reconnect
// is a distinct event (network came back) and worth keeping on.
export const swrConfig: SWRConfiguration = {
  dedupingInterval: 10000,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 0,
  errorRetryInterval: 5000,
  errorRetryCount: 3,
  shouldRetryOnError: true,
  onError: (error) => {
    if (error.status === 401) {
      clearCacheOnLogout()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  },
}

// Preset for data that rarely changes (accounts, categories, workspace, funds,
// cards, payment methods, users). Long dedupe window, no focus refetch.
export const swrStatic: SWRConfiguration = {
  ...swrConfig,
  dedupingInterval: 60000,
  revalidateOnFocus: false,
}

// Preset for expensive computed data that is invalidated explicitly via
// `mutate()` after user actions (dashboards, splits, allocations, net worth,
// fund tracker). No auto-revalidation on focus — mutations own freshness.
export const swrAnalytics: SWRConfiguration = {
  ...swrConfig,
  dedupingInterval: 60000,
  revalidateOnFocus: false,
}

// Preset for user-facing "live" data (pending instances, transactions,
// recurring queue). Short dedupe, focus refetch on, callers may add polling.
export const swrLive: SWRConfiguration = {
  ...swrConfig,
  dedupingInterval: 5000,
  revalidateOnFocus: true,
}

// ============================================================
// Cache key helpers
// ============================================================

// Generate consistent cache keys
function cacheKey(endpoint: string, params?: Record<string, unknown>) {
  if (!params) return endpoint
  return [endpoint, params]
}

// ============================================================
// Accounts
// ============================================================

export function useAccounts(config?: SWRConfiguration) {
  return useSWR<Account[]>(
    '/api/v1/accounts',
    api.getAccounts,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useAccountMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/accounts',
      async (_key, { arg }: { arg: Parameters<typeof api.createAccount>[0] }) => {
        const result = await api.createAccount(arg)
        return result
      }
    ),
    update: useSWRMutation(
      '/api/v1/accounts',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateAccount>[1] } }) => {
        const result = await api.updateAccount(arg.id, arg.data)
        return result
      }
    ),
    delete: useSWRMutation(
      '/api/v1/accounts',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteAccount(arg)
      }
    ),
  }
}

// ============================================================
// Transactions
// ============================================================

export function useTransactions(accountId?: string, config?: SWRConfiguration) {
  const key = accountId
    ? cacheKey('/api/v1/transactions', { accountId })
    : '/api/v1/transactions'

  return useSWR<Transaction[]>(
    key,
    () => api.getTransactions(accountId),
    {
      ...swrLive,
      ...config,
    }
  )
}

export function useTransactionMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/transactions',
      async (_key, { arg }: { arg: Parameters<typeof api.createTransaction>[0] }) => {
        return await api.createTransaction(arg)
      }
    ),
    createTransfer: useSWRMutation(
      '/api/v1/transactions/transfer',
      async (_key, { arg }: { arg: Parameters<typeof api.createTransfer>[0] }) => {
        return await api.createTransfer(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/transactions',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateTransaction>[1] } }) => {
        return await api.updateTransaction(arg.id, arg.data)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/transactions',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteTransaction(arg)
      }
    ),
  }
}

// ============================================================
// Categories
// ============================================================

export function useCategories(type?: 'expense' | 'income', config?: SWRConfiguration) {
  const key = type
    ? cacheKey('/api/v1/categories', { type })
    : '/api/v1/categories'

  return useSWR<Category[]>(
    key,
    () => api.getCategories(type),
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useCategoryMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/categories',
      async (_key, { arg }: { arg: Parameters<typeof api.createCategory>[0] }) => {
        return await api.createCategory(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/categories',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateCategory>[1] } }) => {
        return await api.updateCategory(arg.id, arg.data)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/categories',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteCategory(arg)
      }
    ),
  }
}

// ============================================================
// Subcategories
// ============================================================

export function useSubcategories(categoryId?: string, config?: SWRConfiguration) {
  const key = categoryId
    ? cacheKey('/api/v1/categories/subcategories', { categoryId })
    : '/api/v1/categories/subcategories'

  return useSWR<Subcategory[]>(
    key,
    () => api.getSubcategories(categoryId),
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useSubcategoryMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/categories/subcategories',
      async (_key, { arg }: { arg: Parameters<typeof api.createSubcategory>[0] }) => {
        return await api.createSubcategory(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/categories/subcategories',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateSubcategory>[1] } }) => {
        return await api.updateSubcategory(arg.id, arg.data)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/categories/subcategories',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteSubcategory(arg)
      }
    ),
  }
}

// ============================================================
// Funds
// ============================================================

export function useFunds(config?: SWRConfiguration) {
  return useSWR<Fund[]>(
    '/api/v1/categories/funds',
    api.getFunds,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useFundMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/categories/funds',
      async (_key, { arg }: { arg: Parameters<typeof api.createFund>[0] }) => {
        return await api.createFund(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/categories/funds',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateFund>[1] } }) => {
        return await api.updateFund(arg.id, arg.data)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/categories/funds',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteFund(arg)
      }
    ),
  }
}

// ============================================================
// Workspace
// ============================================================

export function useWorkspace(config?: SWRConfiguration) {
  return useSWR<Workspace>(
    '/api/v1/workspace',
    api.getWorkspace,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useWorkspaceMutations() {
  return {
    update: useSWRMutation(
      '/api/v1/workspace',
      async (_key, { arg }: { arg: Parameters<typeof api.updateWorkspace>[0] }) => {
        return await api.updateWorkspace(arg)
      }
    ),
  }
}

// ============================================================
// User
// ============================================================

export function useMe(config?: SWRConfiguration) {
  return useSWR<UserResponse>(
    '/auth/me',
    api.getMe,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useVerificationStatus(config?: SWRConfiguration) {
  // Live preset: verification state can flip during a session (user clicks
  // magic link in another tab) — keep focus revalidation on.
  return useSWR<{ email_verified: boolean; phone_verified: boolean }>(
    '/auth/verification-status',
    api.getVerificationStatus,
    {
      ...swrLive,
      dedupingInterval: 10000,
      ...config,
    }
  )
}

// ============================================================
// Analytics
// ============================================================

export function useExpenseSplit(year: number, month: number, config?: SWRConfiguration) {
  return useSWR<MonthlyExpenseSplit>(
    cacheKey('/api/v1/analytics/expense-split', { year, month }),
    () => api.getExpenseSplit(year, month),
    {
      ...swrAnalytics,
      ...config,
    }
  )
}

export function useIncomeSplit(year: number, month: number, config?: SWRConfiguration) {
  return useSWR<MonthlyIncomeSplit>(
    cacheKey('/api/v1/analytics/income-split', { year, month }),
    () => api.getIncomeSplit(year, month),
    {
      ...swrAnalytics,
      ...config,
    }
  )
}

export function useIncomeAllocation(years: number = 1, config?: SWRConfiguration) {
  return useSWR<IncomeAllocationResponse>(
    cacheKey('/api/v1/analytics/income-allocation', { years }),
    () => api.getIncomeAllocation(years),
    {
      ...swrAnalytics,
      ...config,
    }
  )
}

export function useAllocationOverrides(year?: number, month?: number, config?: SWRConfiguration) {
  const key = year && month
    ? cacheKey('/api/v1/analytics/fund-allocation-overrides', { year, month })
    : '/api/v1/analytics/fund-allocation-overrides'

  return useSWR<FundAllocationOverride[]>(
    key,
    () => api.getAllocationOverrides(year, month),
    {
      ...swrAnalytics,
      ...config,
    }
  )
}

export function useAllocationOverrideMutations() {
  return {
    createOrUpdate: useSWRMutation(
      '/api/v1/analytics/fund-allocation-overrides',
      async (_key, { arg }: { arg: Parameters<typeof api.createOrUpdateAllocationOverride>[0] }) => {
        return await api.createOrUpdateAllocationOverride(arg)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/analytics/fund-allocation-overrides',
      async (_key, { arg }: { arg: { fundId: string; year: number; month: number } }) => {
        await api.deleteAllocationOverride(arg.fundId, arg.year, arg.month)
      }
    ),
  }
}

export function useFundTracker(years: number = 1, config?: SWRConfiguration) {
  return useSWR<FundTrackerResponse>(
    cacheKey('/api/v1/analytics/fund-tracker', { years }),
    () => api.getFundTracker(years),
    {
      ...swrAnalytics,
      ...config,
    }
  )
}

export function useMonthlyDashboard(year: number, month: number, config?: SWRConfiguration) {
  return useSWR<MonthlyDashboardResponse>(
    cacheKey('/api/v1/analytics/monthly-dashboard', { year, month }),
    () => api.getMonthlyDashboard(year, month),
    {
      ...swrAnalytics,
      ...config,
    }
  )
}

export function useNetWorth(years: number = 1, config?: SWRConfiguration) {
  return useSWR<NetWorthResponse>(
    cacheKey('/api/v1/analytics/net-worth', { years }),
    () => api.getNetWorth(years),
    {
      ...swrAnalytics,
      ...config,
    }
  )
}

// ============================================================
// Prices
// ============================================================

export function usePrice(base: string, quote: string, config?: SWRConfiguration) {
  // Static preset + 5-minute background poll — FX rate is the one piece of
  // static-ish data where slow drift matters, so keep the timer.
  return useSWR<PriceResponse>(
    cacheKey('/api/v1/prices/fx', { base, quote }),
    () => api.getPrice(base, quote),
    {
      ...swrStatic,
      refreshInterval: 300000,
      ...config,
    }
  )
}

// ============================================================
// Cards
// ============================================================

export function useCards(config?: SWRConfiguration) {
  return useSWR<Card[]>(
    '/api/v1/payments/cards',
    api.getCards,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useCardMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/payments/cards',
      async (_key, { arg }: { arg: Parameters<typeof api.createCard>[0] }) => {
        return await api.createCard(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/payments/cards',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateCard>[1] } }) => {
        return await api.updateCard(arg.id, arg.data)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/payments/cards',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteCard(arg)
      }
    ),
  }
}

// ============================================================
// Payment Methods
// ============================================================

export function usePaymentMethods(config?: SWRConfiguration) {
  return useSWR<PaymentMethod[]>(
    '/api/v1/payments/methods',
    api.getPaymentMethods,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function usePaymentMethodMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/payments/methods',
      async (_key, { arg }: { arg: Parameters<typeof api.createPaymentMethod>[0] }) => {
        return await api.createPaymentMethod(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/payments/methods',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updatePaymentMethod>[1] } }) => {
        return await api.updatePaymentMethod(arg.id, arg.data)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/payments/methods',
      async (_key, { arg }: { arg: string }) => {
        await api.deletePaymentMethod(arg)
      }
    ),
  }
}

// ============================================================
// Recurring Transactions
// ============================================================

export function useRecurringTransactions(config?: SWRConfiguration) {
  return useSWR<RecurringTransaction[]>(
    '/api/v1/recurring',
    api.getRecurringTransactions,
    {
      ...swrLive,
      ...config,
    }
  )
}

export function usePendingInstances(config?: SWRConfiguration) {
  // Live preset + background polling — pending instances materialize on a
  // server-side schedule, so timer-driven refresh is the only way to notice
  // them without a user action. Bumped 60s -> 120s now that focus refetch
  // still catches most cases.
  return useSWR<PendingInstance[]>(
    '/api/v1/recurring/pending',
    api.getPendingInstances,
    {
      ...swrLive,
      refreshInterval: 120000,
      ...config,
    }
  )
}

export function useRecurringMutations() {
  return {
    create: useSWRMutation(
      '/api/v1/recurring',
      async (_key, { arg }: { arg: Parameters<typeof api.createRecurringTransaction>[0] }) => {
        return await api.createRecurringTransaction(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/recurring',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateRecurringTransaction>[1] } }) => {
        return await api.updateRecurringTransaction(arg.id, arg.data)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/recurring',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteRecurringTransaction(arg)
      }
    ),
    confirm: useSWRMutation(
      '/api/v1/recurring/confirm',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.confirmRecurring>[1] } }) => {
        return await api.confirmRecurring(arg.id, arg.data)
      }
    ),
    skip: useSWRMutation(
      '/api/v1/recurring/skip',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.skipRecurring>[1] } }) => {
        return await api.skipRecurring(arg.id, arg.data)
      }
    ),
  }
}

// ============================================================
// Scenarios
// ============================================================

export function useScenarios(config?: SWRConfiguration) {
  return useSWR<ScenarioListItem[]>(
    '/api/v1/projections/scenarios',
    api.getScenarios,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useScenario(scenarioId: string | null, config?: SWRConfiguration) {
  return useSWR<Scenario | null>(
    scenarioId ? `/api/v1/projections/scenarios/${scenarioId}` : null,
    scenarioId ? () => api.getScenario(scenarioId) : null,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useActiveScenario(config?: SWRConfiguration) {
  return useSWR<Scenario | null>(
    '/api/v1/projections/scenarios/active',
    api.getActiveScenario,
    {
      ...swrStatic,
      ...config,
    }
  )
}

export function useScenarioMutations() {
  return {
    save: useSWRMutation(
      '/api/v1/projections/scenarios',
      async (_key, { arg }: { arg: Parameters<typeof api.saveScenario>[0] }) => {
        return await api.saveScenario(arg)
      }
    ),
    update: useSWRMutation(
      '/api/v1/projections/scenarios',
      async (_key, { arg }: { arg: { id: string; data: Parameters<typeof api.updateScenario>[1] } }) => {
        return await api.updateScenario(arg.id, arg.data)
      }
    ),
    activate: useSWRMutation(
      '/api/v1/projections/scenarios',
      async (_key, { arg }: { arg: string }) => {
        return await api.activateScenario(arg)
      }
    ),
    delete: useSWRMutation(
      '/api/v1/projections/scenarios',
      async (_key, { arg }: { arg: string }) => {
        await api.deleteScenario(arg)
      }
    ),
  }
}

// ============================================================
// Admin Hooks
// ============================================================

/**
 * Hook for fetching system statistics
 */
export function useSystemStats(config?: SWRConfiguration) {
  return useSWR<SystemStats>(
    '/api/v1/admin/stats',
    adminApi.getSystemStats,
    {
      ...swrStatic,
      ...config,
    }
  )
}

/**
 * Hook for fetching signup growth data
 */
export function useSignupGrowth(days: number = 90, config?: SWRConfiguration) {
  return useSWR<TimeSeriesPoint[]>(
    `/api/v1/admin/growth/signups?days=${days}`,
    () => adminApi.getSignupGrowth(days),
    {
      ...swrStatic,
      ...config,
    }
  )
}

/**
 * Hook for fetching daily active users
 */
export function useDAU(days: number = 30, config?: SWRConfiguration) {
  return useSWR<TimeSeriesPoint[]>(
    `/api/v1/admin/growth/dau?days=${days}`,
    () => adminApi.getDAU(days),
    {
      ...swrStatic,
      ...config,
    }
  )
}

/**
 * Hook for fetching monthly active users
 */
export function useMAU(months: number = 12, config?: SWRConfiguration) {
  return useSWR<TimeSeriesPoint[]>(
    `/api/v1/admin/growth/mau?months=${months}`,
    () => adminApi.getMAU(months),
    {
      ...swrStatic,
      ...config,
    }
  )
}
