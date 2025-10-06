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

type PassKey =
  | 'dashboardOverviewMetricPasses'
  | 'carWashDashboardMetricPasses'
  | 'activeWashesStatusPasses';
type TimingKey =
  | 'dashboardOverviewDerivationMs'
  | 'carWashDashboardDerivationMs'
  | 'activeWashesStatusDerivationMs';

interface GlobalWithPerf extends Window {
  __STAFF_PERF?: StaffPerfCounters;
  __ENABLE_STAFF_PERF?: boolean;
}

// Ensure global singleton (browser only)
function ensureGlobal(): StaffPerfCounters | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as GlobalWithPerf;
  if (!w.__STAFF_PERF) {
    w.__STAFF_PERF = {
      dashboardOverviewMetricPasses: 0,
      carWashDashboardMetricPasses: 0,
      activeWashesStatusPasses: 0,
      dashboardOverviewDerivationMs: [],
      carWashDashboardDerivationMs: [],
      activeWashesStatusDerivationMs: [],
    };
  }
  return w.__STAFF_PERF;
}

function isPassKey(key: PassKey | TimingKey): key is PassKey {
  return (
    key === 'dashboardOverviewMetricPasses' ||
    key === 'carWashDashboardMetricPasses' ||
    key === 'activeWashesStatusPasses'
  );
}

export function recordPerf(key: PassKey | TimingKey, durationMs?: number) {
  if (typeof window === 'undefined') return;
  const w = window as GlobalWithPerf;
  if (!w.__ENABLE_STAFF_PERF) return; // opt-in gate
  const store = ensureGlobal();
  if (!store) return;
  if (isPassKey(key)) {
    store[key] += 1;
  } else if (typeof durationMs === 'number') {
    store[key].push(durationMs);
  }
}

// Helper to wrap a derivation for timing
export function timeDerivation<T>(
  passKey: PassKey,
  timingsKey: TimingKey,
  fn: () => T
): T {
  if (typeof window === 'undefined') return fn();
  const w = window as GlobalWithPerf;
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
  interface Window {
    __STAFF_PERF?: StaffPerfCounters;
    __ENABLE_STAFF_PERF?: boolean;
  }
}
