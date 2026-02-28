// ============================================================
// hooks.ts - SWR hooks for client-side caching with revalidation
// ============================================================

import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import type { SWRConfiguration } from 'swr'
import * as api from './api'
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

export const swrConfig: SWRConfiguration = {
  dedupingInterval: 2000, // Dedupe identical requests within 2s
  revalidateOnFocus: true, // Refresh when user returns to tab
  revalidateOnReconnect: true, // Refresh when reconnected
  refreshInterval: 0, // No automatic polling by default
  errorRetryInterval: 5000, // Retry failed requests every 5s
  errorRetryCount: 3, // Max 3 retries
  shouldRetryOnError: true,
  // Clear cache on 401 (unauthorized)
  onError: (error) => {
    if (error.status === 401) {
      // Clear all cache on auth error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
  },
}

// ============================================================
// Cache key helpers
// ============================================================

// Generate consistent cache keys
function cacheKey(endpoint: string, params?: Record<string, any>) {
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: true,
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: true,
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: false, // Categories rarely change
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: false,
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: false,
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
      ...swrConfig,
      dedupingInterval: 10000, // 10s
      revalidateOnFocus: false,
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
    '/api/v1/auth/me',
    api.getMe,
    {
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: false, // User profile doesn't change often
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
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      ...config,
    }
  )
}

export function useIncomeSplit(year: number, month: number, config?: SWRConfiguration) {
  return useSWR<MonthlyIncomeSplit>(
    cacheKey('/api/v1/analytics/income-split', { year, month }),
    () => api.getIncomeSplit(year, month),
    {
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      ...config,
    }
  )
}

export function useIncomeAllocation(years: number = 1, config?: SWRConfiguration) {
  return useSWR<IncomeAllocationResponse>(
    cacheKey('/api/v1/analytics/income-allocation', { years }),
    () => api.getIncomeAllocation(years),
    {
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
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
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
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
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      ...config,
    }
  )
}

export function useMonthlyDashboard(year: number, month: number, config?: SWRConfiguration) {
  return useSWR<MonthlyDashboardResponse>(
    cacheKey('/api/v1/analytics/monthly-dashboard', { year, month }),
    () => api.getMonthlyDashboard(year, month),
    {
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      ...config,
    }
  )
}

export function useNetWorth(years: number = 1, config?: SWRConfiguration) {
  return useSWR<NetWorthResponse>(
    cacheKey('/api/v1/analytics/net-worth', { years }),
    () => api.getNetWorth(years),
    {
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: true,
      ...config,
    }
  )
}

// ============================================================
// Prices
// ============================================================

export function usePrice(base: string, quote: string, config?: SWRConfiguration) {
  return useSWR<PriceResponse>(
    cacheKey('/api/v1/prices/fx', { base, quote }),
    () => api.getPrice(base, quote),
    {
      ...swrConfig,
      dedupingInterval: 30000, // 30s
      revalidateOnFocus: false,
      refreshInterval: 300000, // Poll every 5 minutes
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: false,
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: false,
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: true,
      ...config,
    }
  )
}

export function usePendingInstances(config?: SWRConfiguration) {
  return useSWR<PendingInstance[]>(
    '/api/v1/recurring/pending',
    api.getPendingInstances,
    {
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: true,
      refreshInterval: 60000, // Poll every minute for pending instances
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
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: false,
      ...config,
    }
  )
}

export function useScenario(scenarioId: string | null, config?: SWRConfiguration) {
  return useSWR<Scenario | null>(
    scenarioId ? `/api/v1/projections/scenarios/${scenarioId}` : null,
    scenarioId ? () => api.getScenario(scenarioId) : null,
    {
      ...swrConfig,
      dedupingInterval: 2000,
      revalidateOnFocus: false,
      ...config,
    }
  )
}

export function useActiveScenario(config?: SWRConfiguration) {
  return useSWR<Scenario | null>(
    '/api/v1/projections/scenarios/active',
    api.getActiveScenario,
    {
      ...swrConfig,
      dedupingInterval: 5000,
      revalidateOnFocus: false,
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
      ...swrConfig,
      revalidateOnFocus: false, // Stats don't change frequently
      dedupingInterval: 30000, // 30s dedup for admin stats
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
      ...swrConfig,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
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
      ...swrConfig,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
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
      ...swrConfig,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      ...config,
    }
  )
}
