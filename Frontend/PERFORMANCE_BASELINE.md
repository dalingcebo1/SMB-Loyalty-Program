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
