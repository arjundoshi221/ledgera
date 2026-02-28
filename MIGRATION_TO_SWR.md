# Migration Guide: From useState to SWR

This guide shows how to migrate existing pages from manual `useState` + `useEffect` patterns to SWR hooks.

---

## Benefits of Migration

### Before (Manual State Management):
```typescript
const [data, setData] = useState<Data[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<Error | null>(null)

useEffect(() => {
  async function load() {
    try {
      const result = await getData()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }
  load()
}, [])
```

**Issues:**
- ❌ No caching (fetches on every mount)
- ❌ No request deduplication
- ❌ Manual loading state management
- ❌ Manual error handling
- ❌ No automatic revalidation
- ❌ Lots of boilerplate

### After (SWR):
```typescript
import { useData } from '@/lib/hooks'

const { data, error, isLoading } = useData()
```

**Benefits:**
- ✅ Automatic caching
- ✅ Request deduplication
- ✅ Built-in loading states
- ✅ Built-in error handling
- ✅ Automatic revalidation
- ✅ 90% less boilerplate
- ✅ Optimistic updates
- ✅ Focus revalidation
- ✅ Retry on error

---

## Step-by-Step Migration

### 1. Install SWR
```bash
npm install swr
```

### 2. Wrap your app with SWRProvider

**File: `frontend/src/app/layout.tsx`**

```typescript
import { SWRProvider } from '@/components/providers/SWRProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SWRProvider>
          {children}
        </SWRProvider>
      </body>
    </html>
  )
}
```

### 3. Migrate Pages

#### Example 1: Dashboard Page

**Before:**
```typescript
// frontend/src/app/(app)/dashboard/page.tsx
"use client"

import { useEffect, useState } from "react"
import { getAccounts, getTransactions } from "@/lib/api"
import type { Account, Transaction } from "@/lib/types"

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const accts = await getAccounts()
        setAccounts(accts)
        if (accts.length > 0) {
          const txns = await getTransactions(accts[0].id)
          setRecentTxns(txns.slice(0, 5))
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      {/* UI */}
    </div>
  )
}
```

**After:**
```typescript
// frontend/src/app/(app)/dashboard/page.tsx
"use client"

import { useAccounts, useTransactions } from "@/lib/hooks"

export default function DashboardPage() {
  const { data: accounts, isLoading: accountsLoading } = useAccounts()
  const { data: allTransactions, isLoading: txnsLoading } = useTransactions(
    accounts && accounts.length > 0 ? accounts[0].id : undefined
  )

  const recentTxns = allTransactions?.slice(0, 5) || []
  const loading = accountsLoading || txnsLoading

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      {/* UI */}
    </div>
  )
}
```

**Changes:**
- ✅ Removed `useState` and `useEffect`
- ✅ Use `useAccounts()` and `useTransactions()` hooks
- ✅ Automatic caching and revalidation
- ✅ 50% less code

---

#### Example 2: Income Allocation Page (with mutations)

**Before:**
```typescript
const [data, setData] = useState<IncomeAllocationResponse | null>(null)
const [loading, setLoading] = useState(true)
const [saving, setSaving] = useState(false)

useEffect(() => {
  loadData()
}, [years])

async function loadData() {
  try {
    setLoading(true)
    const result = await getIncomeAllocation(parseInt(years))
    setData(result)
  } catch (err: any) {
    toast({ variant: "destructive", title: "Failed to load", description: err.message })
  } finally {
    setLoading(false)
  }
}

async function handleSave(fundId: string, year: number, month: number, percentage: number) {
  setSaving(true)
  try {
    await createOrUpdateAllocationOverride({ fund_id: fundId, year, month, allocation_percentage: percentage })
    toast({ title: "Saved" })
    await loadData() // Manual refresh
  } catch (err: any) {
    toast({ variant: "destructive", title: "Failed to save", description: err.message })
  } finally {
    setSaving(false)
  }
}
```

**After:**
```typescript
import { useIncomeAllocation, useAllocationOverrideMutations } from '@/lib/hooks'
import { invalidateAllocationOverrides } from '@/lib/cache'

const { data, error, isLoading, mutate } = useIncomeAllocation(parseInt(years))
const { createOrUpdate } = useAllocationOverrideMutations()

async function handleSave(fundId: string, year: number, month: number, percentage: number) {
  try {
    await createOrUpdate.trigger({
      fund_id: fundId,
      year,
      month,
      allocation_percentage: percentage,
    })
    toast({ title: "Saved" })

    // Invalidate related caches
    await invalidateAllocationOverrides(year, month)

    // Or use optimistic update:
    // await mutate() // Revalidate immediately
  } catch (err: any) {
    toast({ variant: "destructive", title: "Failed to save", description: err.message })
  }
}
```

**Changes:**
- ✅ Removed manual loading state management
- ✅ Use `useSWRMutation` for mutations
- ✅ Smart cache invalidation
- ✅ Optional optimistic updates

---

## Common Patterns

### Pattern 1: Simple Data Fetching

```typescript
// Before
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
useEffect(() => { /* fetch logic */ }, [])

// After
const { data, isLoading } = useAccounts()
```

### Pattern 2: Conditional Fetching

```typescript
// Before
useEffect(() => {
  if (accountId) {
    fetchTransactions(accountId)
  }
}, [accountId])

// After
const { data } = useTransactions(accountId) // Only fetches if accountId is truthy
```

### Pattern 3: Manual Refresh

```typescript
// Before
async function refresh() {
  setLoading(true)
  const data = await fetchData()
  setData(data)
  setLoading(false)
}

// After
const { data, mutate } = useAccounts()

async function refresh() {
  await mutate() // Revalidate immediately
}
```

### Pattern 4: Create/Update/Delete with Cache Invalidation

```typescript
import { invalidateAccounts } from '@/lib/cache'

const mutations = useAccountMutations()

async function handleCreate(data: CreateAccountRequest) {
  try {
    await mutations.create.trigger(data)
    await invalidateAccounts() // Refresh account list
    toast({ title: "Account created" })
  } catch (err) {
    toast({ variant: "destructive", title: "Failed to create account" })
  }
}
```

### Pattern 5: Optimistic Updates

```typescript
import { optimisticUpdate } from '@/lib/cache'

const { data: accounts } = useAccounts()
const mutations = useAccountMutations()

async function handleUpdate(id: string, updates: Partial<Account>) {
  await optimisticUpdate(
    '/api/v1/accounts',
    id,
    updates,
    () => mutations.update.trigger({ id, data: updates })
  )
}
```

---

## Cache Invalidation Rules

After mutations, invalidate related caches:

| Mutation | Invalidate |
|----------|------------|
| `createAccount`, `updateAccount`, `deleteAccount` | `invalidateAccounts()` |
| `createTransaction`, `updateTransaction`, `deleteTransaction` | `invalidateTransactions()` |
| `createCategory`, `updateCategory`, `deleteCategory` | `invalidateCategories()` |
| `createFund`, `updateFund`, `deleteFund` | `invalidateFunds()` |
| `updateWorkspace` | `invalidateWorkspace()` |
| `createOrUpdateAllocationOverride`, `deleteAllocationOverride` | `invalidateAllocationOverrides()` |
| Any data change affecting analytics | `invalidateAnalytics()` |

---

## Error Handling

### SWR Error States

```typescript
const { data, error, isLoading } = useAccounts()

if (error) {
  return <div>Error: {error.message}</div>
}

if (isLoading) {
  return <div>Loading...</div>
}

return <div>{/* Use data */}</div>
```

### Custom Error Handling

```typescript
const { data, error } = useAccounts({
  onError: (err) => {
    console.error('Failed to load accounts:', err)
    toast({ variant: 'destructive', title: 'Failed to load accounts' })
  }
})
```

---

## Testing

### Testing Components with SWR

```typescript
import { SWRConfig } from 'swr'

// Mock data for testing
const mockData = { accounts: [...] }

function TestWrapper({ children }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  )
}

test('renders accounts', () => {
  render(
    <TestWrapper>
      <AccountsPage />
    </TestWrapper>
  )
})
```

---

## Performance Tips

### 1. Disable Revalidation for Static Data

```typescript
const { data } = useCategories('expense', {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
})
```

### 2. Prefetch Data

```typescript
import { prefetch } from '@/lib/cache'

// Prefetch on hover
<Link
  href="/transactions"
  onMouseEnter={() => prefetch('/api/v1/transactions', getTransactions)}
>
  Transactions
</Link>
```

### 3. Conditional Fetching

```typescript
// Don't fetch if not needed
const { data } = useTransactions(showTransactions ? accountId : null)
```

### 4. Polling for Real-time Data

```typescript
const { data } = usePendingInstances({
  refreshInterval: 60000, // Poll every minute
})
```

---

## Troubleshooting

### Cache not updating after mutation?
→ Make sure to call the appropriate `invalidate*()` function after mutations

### Getting stale data?
→ Check `dedupingInterval` and `revalidateOnFocus` settings

### Too many requests?
→ Increase `dedupingInterval` or disable `revalidateOnFocus`

### Want to clear all cache?
→ Call `clearAllCache()` from `@/lib/cache`

---

## Checklist for Migration

- [ ] Install SWR: `npm install swr`
- [ ] Add `<SWRProvider>` to root layout
- [ ] Replace `useState` + `useEffect` with SWR hooks
- [ ] Add cache invalidation after mutations
- [ ] Remove manual loading state management
- [ ] Test cache behavior (navigate away and back)
- [ ] Test mutation invalidation
- [ ] Update MEMORY.md to reflect SWR usage

---

## Next Steps

1. **Phase 1**: Migrate high-traffic pages (dashboard, income-allocation, fund-tracker)
2. **Phase 2**: Migrate remaining pages
3. **Phase 3**: Add HTTP cache headers (backend middleware)
4. **Phase 4**: Add optimistic updates for better UX
5. **Phase 5**: Monitor performance improvements

---

## Resources

- [SWR Documentation](https://swr.vercel.app/)
- [SWR Options](https://swr.vercel.app/docs/options)
- [SWR Mutation](https://swr.vercel.app/docs/mutation)
- [Cache Invalidation](https://swr.vercel.app/docs/mutation#mutate)
