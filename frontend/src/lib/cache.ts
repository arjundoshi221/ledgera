// ============================================================
// cache.ts - Cache invalidation and management utilities
// ============================================================

import { mutate } from 'swr'

/**
 * Cache invalidation utilities for Ledgera
 *
 * Use these functions after mutations to keep the cache in sync
 */

// ============================================================
// Cache Invalidation Helpers
// ============================================================

/**
 * Invalidate all keys matching a pattern
 */
export async function invalidatePattern(pattern: string | RegExp): Promise<void> {
  await mutate(
    (key) => {
      if (typeof key === 'string') {
        if (typeof pattern === 'string') {
          return key.startsWith(pattern)
        }
        return pattern.test(key)
      }
      return false
    },
    undefined,
    { revalidate: true }
  )
}

/**
 * Invalidate a specific key
 */
export async function invalidateKey(key: string): Promise<void> {
  await mutate(key, undefined, { revalidate: true })
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  await mutate(() => true, undefined, { revalidate: false })
}

// ============================================================
// Domain-specific Invalidation
// ============================================================

/**
 * Invalidate account-related caches
 * Call after: createAccount, updateAccount, deleteAccount
 */
export function invalidateAccounts() {
  return Promise.all([
    invalidatePattern('/api/v1/accounts'),
    invalidatePattern('/api/v1/transactions'), // Transactions depend on accounts
    invalidatePattern('/api/v1/analytics'), // Analytics depend on accounts
  ])
}

/**
 * Invalidate transaction-related caches
 * Call after: createTransaction, updateTransaction, deleteTransaction, createTransfer
 */
export function invalidateTransactions(accountId?: string) {
  const promises = [
    invalidatePattern('/api/v1/transactions'),
    invalidatePattern('/api/v1/analytics'), // All analytics depend on transactions
  ]

  // Also invalidate specific account if provided
  if (accountId) {
    promises.push(invalidateKey(`/api/v1/transactions?accountId=${accountId}`))
  }

  return Promise.all(promises)
}

/**
 * Invalidate category-related caches
 * Call after: createCategory, updateCategory, deleteCategory
 */
export function invalidateCategories() {
  return Promise.all([
    invalidatePattern('/api/v1/categories'),
    invalidatePattern('/api/v1/analytics'), // Analytics depend on categories
  ])
}

/**
 * Invalidate subcategory-related caches
 * Call after: createSubcategory, updateSubcategory, deleteSubcategory
 */
export function invalidateSubcategories(categoryId?: string) {
  const promises = [
    invalidatePattern('/api/v1/categories/subcategories'),
    invalidatePattern('/api/v1/analytics'),
  ]

  if (categoryId) {
    promises.push(invalidateKey(`/api/v1/categories/subcategories?categoryId=${categoryId}`))
  }

  return Promise.all(promises)
}

/**
 * Invalidate fund-related caches
 * Call after: createFund, updateFund, deleteFund
 */
export function invalidateFunds() {
  return Promise.all([
    invalidatePattern('/api/v1/categories/funds'),
    invalidatePattern('/api/v1/analytics'), // Analytics depend on funds
  ])
}

/**
 * Invalidate workspace-related caches
 * Call after: updateWorkspace
 */
export function invalidateWorkspace() {
  return Promise.all([
    invalidateKey('/api/v1/workspace'),
    invalidatePattern('/api/v1/analytics'), // Some analytics use workspace settings
  ])
}

/**
 * Invalidate allocation override caches
 * Call after: createOrUpdateAllocationOverride, deleteAllocationOverride
 */
export function invalidateAllocationOverrides(year?: number, month?: number) {
  const promises = [
    invalidatePattern('/api/v1/analytics/fund-allocation-overrides'),
    invalidatePattern('/api/v1/analytics/income-allocation'),
    invalidatePattern('/api/v1/analytics/fund-tracker'),
    invalidatePattern('/api/v1/analytics/monthly-dashboard'),
  ]

  if (year && month) {
    promises.push(
      invalidateKey(`/api/v1/analytics/fund-allocation-overrides?year=${year}&month=${month}`)
    )
  }

  return Promise.all(promises)
}

/**
 * Invalidate all analytics caches
 * Call after: any data change that affects analytics
 */
export function invalidateAnalytics() {
  return invalidatePattern('/api/v1/analytics')
}

/**
 * Invalidate card-related caches
 * Call after: createCard, updateCard, deleteCard
 */
export function invalidateCards() {
  return invalidateKey('/api/v1/payments/cards')
}

/**
 * Invalidate payment method caches
 * Call after: createPaymentMethod, updatePaymentMethod, deletePaymentMethod
 */
export function invalidatePaymentMethods() {
  return invalidateKey('/api/v1/payments/methods')
}

/**
 * Invalidate recurring transaction caches
 * Call after: createRecurring, updateRecurring, deleteRecurring, confirmRecurring, skipRecurring
 */
export function invalidateRecurring() {
  return Promise.all([
    invalidateKey('/api/v1/recurring'),
    invalidateKey('/api/v1/recurring/pending'),
    invalidatePattern('/api/v1/transactions'), // Confirming creates transactions
  ])
}

/**
 * Invalidate pending recurring instances cache
 * Call after: operations that affect pending instances
 */
export function invalidatePendingInstances() {
  return invalidateKey('/api/v1/recurring/pending')
}

/**
 * Invalidate scenario caches
 * Call after: saveScenario, updateScenario, deleteScenario, activateScenario
 */
export function invalidateScenarios() {
  return Promise.all([
    invalidatePattern('/api/v1/projections/scenarios'),
    invalidatePattern('/api/v1/analytics'), // Active scenario affects analytics
  ])
}

// ============================================================
// Auth-related Cache Management
// ============================================================

/**
 * Clear all cache on logout
 */
export function clearCacheOnLogout() {
  clearAllCache()
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token')
    // Clear cache version to force fresh data on next login
    localStorage.removeItem('cache_version')
  }
}

/**
 * Check and update cache version
 * Call on app initialization to invalidate cache after updates
 */
export function checkCacheVersion(currentVersion: string) {
  if (typeof window === 'undefined') return

  const storedVersion = localStorage.getItem('cache_version')

  if (storedVersion !== currentVersion) {
    console.log('[Cache] Version mismatch, clearing cache', { storedVersion, currentVersion })
    clearAllCache()
    localStorage.setItem('cache_version', currentVersion)
  }
}

// ============================================================
// Optimistic Updates
// ============================================================

/**
 * Optimistically update a list by adding an item
 */
export async function optimisticAdd<T extends { id: string }>(
  cacheKey: string,
  newItem: T,
  mutationFn: () => Promise<T>
) {
  // Get current data
  const currentData = await mutate<T[]>(cacheKey)

  if (!currentData) {
    // No cached data, just perform mutation
    return mutationFn()
  }

  try {
    // Optimistically add to cache
    await mutate(cacheKey, [...currentData, newItem], false)

    // Perform actual mutation
    const result = await mutationFn()

    // Update cache with real data
    await mutate(
      cacheKey,
      currentData.map(item => item.id === newItem.id ? result : item).concat(
        currentData.some(item => item.id === newItem.id) ? [] : [result]
      ),
      false
    )

    return result
  } catch (error) {
    // Revert on error
    await mutate(cacheKey, currentData, false)
    throw error
  }
}

/**
 * Optimistically update an item in a list
 */
export async function optimisticUpdate<T extends { id: string }>(
  cacheKey: string,
  itemId: string,
  updates: Partial<T>,
  mutationFn: () => Promise<T>
) {
  const currentData = await mutate<T[]>(cacheKey)

  if (!currentData) {
    return mutationFn()
  }

  try {
    // Optimistically update in cache
    await mutate(
      cacheKey,
      currentData.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
      false
    )

    // Perform actual mutation
    const result = await mutationFn()

    // Update cache with real data
    await mutate(
      cacheKey,
      currentData.map(item => item.id === itemId ? result : item),
      false
    )

    return result
  } catch (error) {
    // Revert on error
    await mutate(cacheKey, currentData, false)
    throw error
  }
}

/**
 * Optimistically delete an item from a list
 */
export async function optimisticDelete<T extends { id: string }>(
  cacheKey: string,
  itemId: string,
  mutationFn: () => Promise<void>
) {
  const currentData = await mutate<T[]>(cacheKey)

  if (!currentData) {
    return mutationFn()
  }

  try {
    // Optimistically remove from cache
    await mutate(
      cacheKey,
      currentData.filter(item => item.id !== itemId),
      false
    )

    // Perform actual mutation
    await mutationFn()
  } catch (error) {
    // Revert on error
    await mutate(cacheKey, currentData, false)
    throw error
  }
}

// ============================================================
// Prefetching
// ============================================================

/**
 * Prefetch data for faster navigation
 */
export function prefetch<T>(cacheKey: string, fetcher: () => Promise<T>) {
  // This will populate the cache without triggering a re-render
  return mutate(cacheKey, fetcher())
}

// ============================================================
// Cache Statistics (Development only)
// ============================================================

/**
 * Get cache statistics for debugging
 * Only use in development
 */
export function getCacheStats() {
  if (typeof window === 'undefined') return null

  // This is a rough estimate - SWR doesn't expose cache internals
  const cacheVersion = localStorage.getItem('cache_version')

  return {
    cacheVersion,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Log cache activity for debugging
 */
export function enableCacheLogging() {
  if (typeof window === 'undefined') return

  // Store original console.log
  const originalLog = console.log

  // Intercept SWR cache activity (this is hacky and for dev only)
  ;(window as any).__SWR_CACHE_LOGGING__ = true

  console.log('[Cache] Logging enabled')
}
