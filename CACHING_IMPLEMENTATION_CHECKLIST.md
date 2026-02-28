# Browser Caching Implementation Checklist

## Phase 1: SWR Client Cache (HIGH PRIORITY - Immediate Impact)

### Setup
- [ ] **Install SWR**
  ```bash
  cd frontend && npm install swr
  ```

- [ ] **Add SWRProvider to root layout**
  - File: `frontend/src/app/layout.tsx`
  - Import and wrap children with `<SWRProvider>`

### Core Files (Already Created)
- [x] `frontend/src/lib/hooks.ts` - SWR hooks for all API endpoints
- [x] `frontend/src/lib/cache.ts` - Cache invalidation utilities
- [x] `frontend/src/components/providers/SWRProvider.tsx` - Global SWR configuration
- [x] `CACHING_STRATEGY.md` - Comprehensive documentation
- [x] `MIGRATION_TO_SWR.md` - Migration guide with examples

### Page Migrations (Priority Order)

#### High Priority (Most Visited)
- [ ] **Income Allocation Page**
  - File: `frontend/src/app/(app)/income-allocation/page.tsx`
  - Replace manual state with `useIncomeAllocation(years)`
  - Replace manual mutations with `useAllocationOverrideMutations()`
  - Add `invalidateAllocationOverrides()` after mutations
  - Estimated impact: 40% reduction in API calls

- [ ] **Fund Tracker Page**
  - File: `frontend/src/app/(app)/fund-tracker/page.tsx`
  - Replace manual state with `useFundTracker(years)`
  - Estimated impact: 30% reduction in API calls

- [ ] **Dashboard Page**
  - File: `frontend/src/app/(app)/dashboard/page.tsx`
  - Replace manual state with `useAccounts()` and `useTransactions()`
  - Estimated impact: 25% reduction in API calls

- [ ] **Portfolio (Net Worth) Page**
  - File: `frontend/src/app/(app)/portfolio/page.tsx`
  - Replace manual state with `useNetWorth(years)`
  - Estimated impact: 30% reduction in API calls

#### Medium Priority
- [ ] **Expense Split Page**
  - File: `frontend/src/app/(app)/expense-split/page.tsx`
  - Replace manual state with `useExpenseSplit(year, month)` and `useIncomeSplit(year, month)`

- [ ] **Transactions Page**
  - File: `frontend/src/app/(app)/transactions/page.tsx`
  - Replace manual state with `useTransactions(accountId)`
  - Add `useTransactionMutations()` for CRUD operations

- [ ] **Settings Page**
  - File: `frontend/src/app/(app)/settings/page.tsx`
  - Replace manual state with:
    - `useAccounts()` for accounts tab
    - `useCategories()` for categories tab
    - `useFunds()` for funds tab
    - `useCards()` for cards tab
    - `usePaymentMethods()` for payment methods tab
    - `useWorkspace()` for workspace settings

- [ ] **Projections Page**
  - File: `frontend/src/app/(app)/projections/page.tsx`
  - Replace manual state with `useScenarios()` and `useActiveScenario()`

#### Low Priority
- [ ] **Admin Pages** (if applicable)
  - Admin dashboard
  - User management
  - Audit log

### Testing
- [ ] **Test cache behavior**
  - Navigate to Income Allocation → navigate away → come back
  - Should show cached data immediately, then update in background

- [ ] **Test invalidation**
  - Update an allocation override
  - Verify income allocation list refreshes automatically

- [ ] **Test focus revalidation**
  - Open Income Allocation page
  - Switch to another tab/window for 30+ seconds
  - Switch back
  - Should automatically fetch fresh data

- [ ] **Test error handling**
  - Disconnect network
  - Verify error states display correctly
  - Verify cached data is still shown when possible

- [ ] **Test request deduplication**
  - Open multiple components that use `useAccounts()` simultaneously
  - Verify only 1 API call is made (check browser Network tab)

### Monitoring
- [ ] **Add performance logging**
  - Log cache hits/misses in development
  - Measure before/after load times

- [ ] **Track metrics**
  - API call volume (before/after)
  - Average page load time
  - Cache hit rate

---

## Phase 2: HTTP Cache Headers (MEDIUM PRIORITY - Bandwidth Savings)

### Backend Setup
- [ ] **Add cache middleware to FastAPI**
  - File: `src/api/main.py`
  - Import `CacheControlMiddleware` from `src/api/middleware_cache.py`
  - Add middleware: `app.add_middleware(CacheControlMiddleware)`

- [ ] **Test HTTP caching**
  - Open browser DevTools → Network tab
  - Make a request to `/api/v1/accounts`
  - Check response headers for `Cache-Control` and `ETag`
  - Make same request again → should show "304 Not Modified" or cached response

- [ ] **Verify Vary header**
  - Ensure `Vary: Authorization` is present (per-user caching)

### Configuration
- [x] Cache strategies defined in `middleware_cache.py`
- [ ] Fine-tune cache durations based on real usage patterns
- [ ] Consider adding ETag support at route level for better performance

---

## Phase 3: Advanced Features (OPTIONAL - Future Enhancements)

### Service Worker (Offline Support)
- [ ] Create service worker for offline caching
- [ ] Add cache-first strategy for static assets
- [ ] Add network-first strategy for API calls with fallback to cache

### IndexedDB (Large Dataset Storage)
- [ ] Implement IndexedDB wrapper for large datasets
- [ ] Cache projections/scenarios in IndexedDB
- [ ] Add background sync for offline changes

### Prefetching
- [ ] Prefetch data on hover (e.g., hover over "Transactions" link)
- [ ] Prefetch next month's data when viewing current month
- [ ] Prefetch related data (e.g., when viewing account, prefetch its transactions)

### Optimistic Updates
- [ ] Add optimistic updates to frequently used mutations
  - Account creation
  - Transaction creation
  - Allocation override updates
- [ ] Implement rollback on error

---

## Phase 4: Documentation & Training

### Documentation
- [x] Comprehensive caching strategy (`CACHING_STRATEGY.md`)
- [x] Migration guide (`MIGRATION_TO_SWR.md`)
- [ ] Update `README.md` with caching information
- [ ] Update `MEMORY.md` with final implementation details
- [ ] Add JSDoc comments to hooks

### Code Review
- [ ] Review all migrated pages
- [ ] Ensure consistent error handling
- [ ] Verify cache invalidation is called after all mutations
- [ ] Check for any remaining manual state management

---

## Estimated Timeline

| Phase | Duration | Impact |
|-------|----------|--------|
| Phase 1: SWR Setup + High Priority Pages | 2-3 hours | 60-70% API call reduction |
| Phase 1: Medium Priority Pages | 2-3 hours | Additional 10-15% reduction |
| Phase 2: HTTP Cache Headers | 1 hour | 10-20% bandwidth savings |
| Phase 3: Advanced Features | 4-6 hours (optional) | Offline support, better UX |
| Phase 4: Documentation & Review | 1-2 hours | Long-term maintainability |

**Total: 6-9 hours for core implementation (Phases 1-2)**

---

## Success Metrics

### Before (Baseline)
- Measure current metrics:
  - [ ] Average page load time (dashboard, income allocation, fund tracker)
  - [ ] API call volume (requests per minute)
  - [ ] Network bandwidth usage

### After (Target Improvements)
- [ ] **Load time**: 50-70% faster (especially on navigation back)
- [ ] **API calls**: 60-80% reduction
- [ ] **Bandwidth**: 30-50% reduction (with HTTP cache)
- [ ] **User experience**: Instant navigation with cached data

### How to Measure
```typescript
// Add to SWRProvider for development
const swrConfig = {
  ...existingConfig,
  onSuccess: (data, key) => {
    console.log('[Cache HIT]', key)
  },
  onError: (error, key) => {
    console.error('[Cache MISS]', key, error)
  },
}
```

---

## Rollback Plan

If issues arise:

1. **Quick rollback**: Remove `<SWRProvider>` from layout
2. **Partial rollback**: Revert specific pages to old implementation
3. **Full rollback**: Remove SWR dependency, restore all `useState` + `useEffect` patterns

### Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stale data shown to user | Medium | Short cache TTLs, focus revalidation enabled |
| Cache not invalidated after mutation | High | Comprehensive `invalidate*()` utilities, code review |
| Memory usage increase (cache in memory) | Low | SWR automatically cleans up unused cache entries |
| Breaking changes in SWR library | Low | Pin SWR version, test before upgrading |

---

## Questions to Resolve

- [ ] Should admin endpoints be cached at all? (Recommendation: No)
- [ ] What's the acceptable staleness for analytics data? (Current: 2 min)
- [ ] Should we implement optimistic updates? (Recommendation: Phase 3)
- [ ] Do we need offline support? (Recommendation: Phase 3, not critical)
- [ ] Should we cache bug report submissions? (Recommendation: No)

---

## Sign-off Checklist

Before marking Phase 1 complete:

- [ ] All high-priority pages migrated
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Cache invalidation working correctly
- [ ] Performance improvement verified
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] MEMORY.md updated with final architecture

---

## Additional Resources

- **SWR Docs**: https://swr.vercel.app/
- **HTTP Caching**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching
- **Cache-Control**: https://web.dev/http-cache/
- **Project Files**:
  - `frontend/src/lib/hooks.ts` - All SWR hooks
  - `frontend/src/lib/cache.ts` - Invalidation utilities
  - `src/api/middleware_cache.py` - HTTP cache middleware
  - `CACHING_STRATEGY.md` - Strategy documentation
  - `MIGRATION_TO_SWR.md` - Migration guide

---

## Notes

- **Cache version**: Currently `1.0.0` - increment when making breaking API changes
- **Cache storage**: In-memory (browser) + HTTP cache (browser)
- **Cache isolation**: Per-user via `Vary: Authorization` header
- **Cache duration**: 1-30 minutes depending on data type
- **Revalidation**: On focus, on reconnect, on demand

**Start with Phase 1 high-priority pages for immediate impact!**
