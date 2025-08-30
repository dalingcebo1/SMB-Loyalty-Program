# Performance Baseline (Phase 0)

Scope: Staff dashboard & analytics (CarWashDashboard, DashboardOverview, EnhancedAnalytics, ActiveWashesManager) – initial render & recomputation hotspots before optimization.

## Identified Hotspots (Pre‑optimization)

Component: DashboardOverview
- Multiple history.filter passes (5 separate scans) each render.
- Redundant date slicing (w.started_at.slice(0,10)) repeated per filter.
- MetricCard is a simple functional component re-rendering even when individual metric props unchanged.

Component: CarWashDashboard
- Inline IIFE inside JSX to build BarChart data; executes every parent render.
- Separate filter passes for completedList & inProgressList (2 scans).

Component: ActiveWashesManager
- getStatusSummary recomputed each render; uses filter to detect longRunning.
- ActiveWashCard recalculates duration on every rerender (expected) – future enhancement: timer tick instead of per parent render.

Component: EnhancedAnalytics
- Already uses useCallback + useEffect to gate recalculation; moderate.
- Chart data generation in generateChartData with O(n) map + reduce – acceptable but will benefit from memo if inputs stable.

Backend (payments/history endpoint – qualitative observation)
- Potential N+1 pattern when enriching washes with user/vehicle (to verify later in Phase 5).

## Baseline Complexity Estimates
(Counts are static analyses / theoretical; real timings to be gathered with React Profiler.)

DashboardOverview render cost per render (n = history length):
- Filters: 5 * O(n)
- Reduce for avgDuration: up to O(n) over completed subset
Approx upper bound: ~6 full passes.

CarWashDashboard render cost:
- Filters: 2 * O(n)
- Chart derivation: 1 * O(n) (date counting)
Total: ~3 passes.

ActiveWashesManager:
- Status summary: 1 * O(a) where a = activeWashes.length
- Card mapping: O(a)

## Measurement Plan (To Execute Manually)
1. React DevTools Profiler
   - Record interactions navigating to staff dashboard & switching filters / periods.
   - Capture commit times before & after Phase 1 changes.
2. React Query DevTools (if enabled) – verify no additional network calls introduced.
3. Console instrumentation (optional transient): console.count in key components to confirm reduced renders after memoization.
4. Bundle size (later Phase 4): Run `vite build --analyze` (already have bundle-stats.html) – capture pre-optimization size for staff bundle chunk.
5. Backend timing sampling: Use browser Network panel to log average latency for /payments/history (10 samples) & /payments/dashboard-analytics.

### Added Instrumentation (Phase 1 Post Commit)
- Optional in-browser counters now available. To enable before navigating to staff pages, run in DevTools console:
   `window.__ENABLE_STAFF_PERF = true;`
- After interacting, inspect: `window.__STAFF_PERF` for:
   - `dashboardOverviewMetricPasses`
   - `carWashDashboardMetricPasses`
   - `activeWashesStatusPasses`
   - Derivation timing arrays (`*DerivationMs`) to compute mean / p95.

Example quick summary snippet you can paste after usage:
```
const p = window.__STAFF_PERF; const summarize = arr => ({n: arr.length, mean: (arr.reduce((s,v)=>s+v,0)/Math.max(arr.length,1)).toFixed(2), p95: arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length*0.95)]});
({
   overviewPasses: p.dashboardOverviewMetricPasses,
   overviewTiming: summarize(p.dashboardOverviewDerivationMs),
   carWashPasses: p.carWashDashboardMetricPasses,
   carWashTiming: summarize(p.carWashDashboardDerivationMs),
   activeStatusPasses: p.activeWashesStatusPasses,
   activeStatusTiming: summarize(p.activeWashesStatusDerivationMs)
});
```

## Success Criteria for Phase 1
- Reduce DashboardOverview filter passes from 5+ to 1 (aggregate pass) via a single loop or pre-grouping (useMemo) → ~80% reduction in per-render array traversal cost.
- Eliminate inline anonymous IIFE recomputation in CarWashDashboard – move to useMemo with stable dependencies.
- Memoize MetricCard and ActiveWashCard (prevent unnecessary rerenders when props unchanged) – expect fewer child renders in Profiler.
- Zero functional / UI output changes.

## Risks / Constraints
- Must not alter data freshness semantics (React Query caches). UseMemo only for pure derivations from immutable arrays.
- Duration display in ActiveWashCard currently based on new Date() each render; memoization must not freeze live duration. (Deferred improvement: introduce an interval tick state.)

## Next Phases Preview
- Phase 1 (implemented next): Memoization & render stabilization.
- Phase 2: React Query staleTime / select to trim data shape.
- Phase 3: Virtualize large history list when length threshold > 50.
- Phase 4: Code-splitting (lazy load analytics & heavy charts) & tree-shaking review.
- Phase 5: Optimize backend query joins (remove N+1) and add indices if needed.

(Generated automatically – update after capturing real profiler numbers.)

---

## Phase 4 Progress (In Flight)

Goals:
- Reduce initial staff dashboard JS payload by deferring heavy, seldom-needed analytics & chart libraries.
- Ensure no functional regressions (all UI still reachable; show lightweight skeletons while loading chunks).

Actions Completed:
1. Lazy-loaded `EnhancedAnalytics` via `EnhancedAnalyticsLazy` with lightweight skeleton fallback.
2. Converted Recharts usage in `CarWashDashboard` to a lazily loaded `WashesByDateChart` component (separate dynamic chunk) guarded by a Suspense fallback.
3. Maintained existing manual chunk config (charts chunk) while removing eager static import paths so charts load on demand.

Planned / Optional Next Steps:
- Capture bundle size diff (run production build & compare pre/post sizes; record in this section).
- Evaluate further splitting: admin-only pages, large form resolvers, or Firebase sub-modules not needed at startup.
- Consider prefetching analytics chunk on user idle after dashboard settles (using `requestIdleCallback`).

Success Metrics (to record after build):
- % reduction in initial loaded JS (before user interacts with analytics or chart area).
- Time-to-interactive unchanged or improved on mid-range device.

No functional changes introduced; fallbacks provide immediate feedback during lazy load.

---

## Phase 6 Kickoff (In Progress)

Objectives:
- Introduce lightweight backend performance guardrails (rolling latency & cache metrics for `/dashboard-analytics`).
- Add database indexes to support range filtering and status/date lookups used in analytics and history endpoints.
- Add automated test ensuring analytics cache hit + invalidation behavior works as expected (prevents silent regression).

Implemented So Far:
1. Rolling metrics in backend (`/api/payments/dashboard-analytics/meta`) now expose:
   - calls, cache_hits, hit_rate, p50_ms, p95_ms (computed over last 200 samples).
2. Added Alembic migration adding indexes:
   - orders.started_at, orders.ended_at
   - payments.created_at, (status, created_at)
   - order_vehicles(order_id, vehicle_id) unique composite (supports fast existence checks)
3. New test `test_analytics_cache.py` validating cache miss → hit → invalidation path.

Planned Next (Phase 6 Remaining):
- Frontend idle prefetch for analytics & chart chunks post-dashboard settle.
- Bundle size snapshot & record pre/post numbers here.
- Optional LRU bound on analytics cache (current usage minimal; may defer).
- Persist structured log line for analytics latency (future central aggregation capability).

Success Criteria:
- Cache hit rate visible & >50% during rapid successive dashboard refreshes in a 30s window.
- p95 analytics latency remains stable (< threshold to be defined after baseline capture).
- Automated test protects cache/invalidation behavior.

Metrics Capture TODO:
- Record p50/p95 before & after indexes (will require pointing at non-empty dataset in staging / local with synthetic load).
