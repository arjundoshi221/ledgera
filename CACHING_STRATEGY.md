# Browser Caching Strategy for Ledgera

## Overview
Multi-layer caching strategy to reduce load times while maintaining data freshness and security.

---

## 🎯 Goals
1. **Performance**: Reduce API calls by 70-90%
2. **UX**: Show cached data immediately, update in background
3. **Safety**: Proper invalidation, user isolation, security
4. **Flexibility**: Different strategies for different data types

---

## 🏗️ Architecture Layers

### Layer 1: HTTP Cache (Browser Native)
**What**: Browser's built-in HTTP cache using Cache-Control headers
**Managed by**: Backend (FastAPI middleware)
**Best for**: Static data, rarely-changing resources

```
Cache-Control: max-age=300, stale-while-revalidate=60
ETag: "abc123xyz"
```

**Strategy by endpoint**:
- `/api/v1/accounts` → 5 min (changes infrequently)
- `/api/v1/categories` → 10 min (rarely changes)
- `/api/v1/funds` → 10 min (rarely changes)
- `/api/v1/transactions` → 1 min (changes frequently)
- `/api/v1/analytics/*` → 2 min (computed, expensive)
- `/api/v1/workspace` → 30 min (rarely changes)
- `/api/v1/prices` → 15 min (external API, rate-limited)

### Layer 2: SWR Client Cache (Memory)
**What**: React hooks with smart revalidation (using `swr` library)
**Managed by**: Frontend React hooks
**Best for**: All API data with automatic revalidation

**Features**:
- Request deduplication (multiple components → 1 request)
- Stale-while-revalidate (show cached, fetch fresh)
- Focus revalidation (refresh when user returns to tab)
- Interval polling (for real-time-ish data)
- Error retry with exponential backoff
- Optimistic updates

**Configuration**:
```typescript
{
  dedupingInterval: 2000,        // Dedupe identical requests within 2s
  revalidateOnFocus: true,       // Refresh when user returns to tab
  revalidateOnReconnect: true,   // Refresh when reconnected
  refreshInterval: 0,            // No automatic polling (set per-hook)
  errorRetryInterval: 5000,      // Retry failed requests every 5s
  errorRetryCount: 3,            // Max 3 retries
  shouldRetryOnError: true,
}
```

### Layer 3: Persistent Cache (Optional/Future)
**What**: IndexedDB or LocalStorage for offline support
**Managed by**: Service worker or custom cache wrapper
**Best for**: Scenarios, projections, historical data

**Not implementing in Phase 1** (add later if needed)

---

## 🔐 Safety Features

### 1. Cache Isolation
- **User-level**: Cache keys include `workspace_id` from auth token
- **Workspace-level**: Different workspaces = different cache
- **Auto-clear**: Clear cache on logout

```typescript
// Cache key format: `/api/v1/accounts?workspace=${workspaceId}`
const cacheKey = [endpoint, { workspace: user.workspace_id }]
```

### 2. Cache Invalidation
**When to invalidate**:
- ✅ After CREATE operations → Invalidate list endpoints
- ✅ After UPDATE operations → Invalidate specific item + list
- ✅ After DELETE operations → Invalidate specific item + list
- ✅ On logout → Clear all cache
- ✅ On workspace switch → Clear all cache

**How to invalidate**:
```typescript
import { mutate } from 'swr'

// Invalidate specific key
mutate('/api/v1/accounts')

// Invalidate all keys matching pattern
mutate(key => typeof key === 'string' && key.startsWith('/api/v1/accounts'))

// Revalidate immediately
mutate('/api/v1/accounts', undefined, { revalidate: true })
```

### 3. Version Control
- Cache version in `package.json`
- Clear cache on version mismatch (app updates)
- Store version in localStorage

```typescript
const CACHE_VERSION = '1.0.0'
if (localStorage.getItem('cache_version') !== CACHE_VERSION) {
  // Clear cache
  localStorage.setItem('cache_version', CACHE_VERSION)
}
```

### 4. Security
- ❌ Never cache sensitive data in LocalStorage (tokens are httpOnly cookies)
- ❌ Never cache admin endpoints (always fresh)
- ✅ Cache keys include user context (automatic isolation)
- ✅ Clear cache on auth errors (401/403)

### 5. Error Handling
- **Network errors**: Show cached data with warning
- **Auth errors**: Clear cache and redirect to login
- **Server errors**: Retry with exponential backoff
- **Stale data**: Visual indicator when showing cached data

---

## 📊 Cache Strategies by Data Type

| Data Type | HTTP Cache | SWR Dedupe | Revalidate On Focus | Refresh Interval | Notes |
|-----------|------------|------------|---------------------|------------------|-------|
| **Accounts** | 5 min | 2s | Yes | 0 | Changes infrequently |
| **Transactions** | 1 min | 2s | Yes | 0 | Changes frequently |
| **Categories/Funds** | 10 min | 2s | No | 0 | Rarely changes |
| **Analytics** | 2 min | 5s | Yes | 0 | Expensive, computed |
| **Workspace** | 30 min | 10s | No | 0 | Rarely changes |
| **FX Prices** | 15 min | 30s | No | 300000 (5 min) | External API, poll |
| **Projections** | 0 | 2s | No | 0 | User-specific, transient |
| **Dashboard** | 1 min | 2s | Yes | 0 | Aggregated data |

---

## 🚀 Implementation Steps

### Phase 1: SWR Client Cache (Immediate - High Impact)
1. ✅ Install SWR: `npm install swr`
2. ✅ Create `frontend/src/lib/hooks.ts` with SWR hooks
3. ✅ Create `frontend/src/lib/cache.ts` with invalidation utilities
4. ✅ Migrate pages from `useState` to SWR hooks
5. ✅ Add optimistic updates for mutations

**Estimated improvement**: 60-80% reduction in API calls

### Phase 2: HTTP Cache Headers (Medium Impact)
1. ✅ Add FastAPI middleware for Cache-Control headers
2. ✅ Implement ETag support for conditional requests
3. ✅ Add Vary: Authorization header (per-user caching)

**Estimated improvement**: Additional 10-20% reduction in bandwidth

### Phase 3: Advanced Features (Optional/Future)
1. ⏳ Service Worker for offline support
2. ⏳ IndexedDB for large datasets
3. ⏳ Prefetching/preloading
4. ⏳ Background sync

---

## 📈 Monitoring & Metrics

### What to track:
- Cache hit rate (SWR)
- Average load time (before/after)
- API call volume (before/after)
- Error rates
- Stale data incidents

### How to track:
```typescript
// Log cache performance
const swrConfig = {
  onSuccess: (data, key) => {
    console.log('[Cache] Hit:', key)
  },
  onError: (error, key) => {
    console.error('[Cache] Miss:', key, error)
  }
}
```

---

## 🔄 Migration Guide

### Before (Current):
```typescript
const [accounts, setAccounts] = useState<Account[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  async function load() {
    try {
      const data = await getAccounts()
      setAccounts(data)
    } catch (error) {
      // handle error
    } finally {
      setLoading(false)
    }
  }
  load()
}, [])
```

### After (With SWR):
```typescript
import { useAccounts } from '@/lib/hooks'

const { data: accounts, error, isLoading, mutate } = useAccounts()
```

**Benefits**:
- ✅ Automatic caching and revalidation
- ✅ Request deduplication
- ✅ Error retry
- ✅ Loading states
- ✅ 90% less boilerplate

---

## 🛡️ Testing Strategy

### Test scenarios:
1. **Cache hit**: Navigate away and back → should show cached data
2. **Revalidation**: Focus tab after 30s → should fetch fresh data
3. **Invalidation**: Create account → should refresh account list
4. **Stale data**: Disconnect network → should show cached data
5. **Error recovery**: Server error → should retry and show cached data
6. **User isolation**: Switch workspace → should clear cache
7. **Security**: Logout → should clear all cache

---

## 📝 Best Practices

### DO:
- ✅ Use SWR for all API calls
- ✅ Invalidate cache after mutations
- ✅ Show loading states
- ✅ Handle errors gracefully
- ✅ Use optimistic updates for better UX
- ✅ Monitor cache performance

### DON'T:
- ❌ Cache sensitive data in LocalStorage
- ❌ Use infinite cache TTL
- ❌ Forget to invalidate after mutations
- ❌ Cache admin/audit endpoints
- ❌ Share cache across users
- ❌ Ignore error states

---

## 🎓 Resources

- [SWR Documentation](https://swr.vercel.app/)
- [HTTP Caching Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Cache-Control Best Practices](https://web.dev/http-cache/)
- [ETags Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
