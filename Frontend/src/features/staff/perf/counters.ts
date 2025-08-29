// Lightweight optional performance counters for staff dashboard components.
// Activate by setting window.__ENABLE_STAFF_PERF = true in the browser console
// BEFORE navigating / rendering the staff dashboard pages.
// Access results via window.__STAFF_PERF.

export interface StaffPerfCounters {
  dashboardOverviewMetricPasses: number;
  carWashDashboardMetricPasses: number;
  activeWashesStatusPasses: number;
  dashboardOverviewDerivationMs: number[]; // each run duration
  carWashDashboardDerivationMs: number[];
  activeWashesStatusDerivationMs: number[];
}

// Ensure global singleton (browser only)
function ensureGlobal(): StaffPerfCounters | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as any;
  if (!w.__STAFF_PERF) {
    w.__STAFF_PERF = {
      dashboardOverviewMetricPasses: 0,
      carWashDashboardMetricPasses: 0,
      activeWashesStatusPasses: 0,
      dashboardOverviewDerivationMs: [],
      carWashDashboardDerivationMs: [],
      activeWashesStatusDerivationMs: [],
    } as StaffPerfCounters;
  }
  return w.__STAFF_PERF as StaffPerfCounters;
}

export function recordPerf(
  key: keyof StaffPerfCounters,
  durationMs?: number
) {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (!w.__ENABLE_STAFF_PERF) return; // opt-in gate
  const store = ensureGlobal();
  if (!store) return;
  if (key.endsWith('Passes')) {
    // increment numeric counter
    (store as any)[key] += 1;
  } else if (Array.isArray((store as any)[key]) && typeof durationMs === 'number') {
    (store as any)[key].push(durationMs);
  }
}

// Helper to wrap a derivation for timing
export function timeDerivation<T>(
  passKey: keyof StaffPerfCounters,
  timingsKey: keyof StaffPerfCounters,
  fn: () => T
): T {
  if (typeof window === 'undefined') return fn();
  const w = window as any;
  if (!w.__ENABLE_STAFF_PERF) return fn();
  const start = performance.now();
  recordPerf(passKey);
  try {
    return fn();
  } finally {
    const end = performance.now();
    recordPerf(timingsKey, end - start);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __STAFF_PERF: StaffPerfCounters | undefined; // readable in console
  // eslint-disable-next-line no-var
  var __ENABLE_STAFF_PERF: boolean | undefined; // opt-in flag
}
