import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/api';
import { queryClient } from '../api/queryClient';

// Prefetch utilities: idle chunk preloading + data prefetch hooks
// Phase 6 frontend: improve perceived performance navigating to heavy routes (analytics, charts, admin forms)

// 1. Chunk preloading via dynamic import warm-up
// We conditionally (and lazily) reference the same dynamic import functions used in route lazy() calls.
// This ensures Vite produces the same chunk and the browser caches it ahead of navigation.

// IMPORTANT: Keep these imports wrapped in functions; calling them triggers fetch.
export const preloadAnalyticsChunk = () => import('../features/staff/components/EnhancedAnalytics');
export const preloadChartsVendors = () => Promise.all([
  import('recharts'),
  import('react-circular-progressbar')
]);
// Wash history (heavy tables + analytics)
export const preloadWashHistory = () => import('../features/staff/components/EnhancedWashHistory');

// Admin pages (barrel) prefetch: importing each lazily-used page ensures their chunks are warmed.
export const preloadAdminWelcome = () => import('../pages/admin/AdminWelcome');
export const preloadAdminStaffRegister = () => import('../pages/admin/StaffRegisterForm');
export const preloadAdminModuleSettings = () => import('../pages/admin/ModuleSettings');
export const preloadAdminUserEdit = () => import('../pages/AdminUserEdit');
export const preloadAdminTenantsList = () => import('../pages/admin/TenantsList');
export const preloadAdminTenantEdit = () => import('../pages/admin/TenantEdit');

// 2. Idle callback helper with fallback
// Use existing lib.dom definitions if available; fall back to casting.
const requestIdle: (cb: () => void) => void = (cb) => {
  if (typeof window === 'undefined') return;
  const win = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  const ric = win.requestIdleCallback;
  if (typeof ric === 'function') {
    ric(() => cb(), { timeout: 2500 });
  } else {
    setTimeout(cb, 1200);
  }
};

const MAX_PREFETCH_ATTEMPTS = 3;
const LOW_BANDWIDTH_DL_THRESHOLD = 1.5; // Mbps

const shouldDeferHeavyPrefetch = () => {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as unknown as { connection?: { downlink?: number; saveData?: boolean } }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  const downlink = typeof conn.downlink === 'number' ? conn.downlink : undefined;
  return typeof downlink === 'number' && downlink > 0 && downlink < LOW_BANDWIDTH_DL_THRESHOLD;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(task: () => Promise<T>, retries = 2, delayMs = 500): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (err) {
      if (attempt >= retries) {
        throw err;
      }
      const backoff = delayMs * Math.pow(2, attempt);
      await sleep(backoff);
      attempt += 1;
    }
  }
}

const prefetchAnalyticsData = () => withRetry(() => queryClient.prefetchQuery({
  queryKey: ['analytics', 'prefetch', 7],
  queryFn: async () => {
    const { data } = await api.get('/payments/business-analytics', { params: { range_days: 7, recent_days: 7 } });
    return data;
  },
  staleTime: 60_000,
}), 1, 800).catch(err => {
  console.warn('[prefetch] analytics data prefetch failed', err);
});

let analyticsPreloaded = false;
let analyticsPrefetchInFlight = false;
let analyticsPrefetchAttempts = 0;

let adminPreloaded = false;
let adminPrefetchInFlight = false;
let adminPrefetchAttempts = 0;

export function scheduleAnalyticsPrefetch() {
  if (analyticsPreloaded || analyticsPrefetchInFlight || analyticsPrefetchAttempts >= MAX_PREFETCH_ATTEMPTS) {
    return;
  }
  analyticsPrefetchInFlight = true;
  requestIdle(() => {
    const run = async () => {
      const deferHeavy = shouldDeferHeavyPrefetch();
      try {
        if (!deferHeavy) {
          if (typeof performance !== 'undefined') {
            performance.mark('analytics-prefetch-start');
          }
          await withRetry(async () => {
            const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            await Promise.all([
              preloadAnalyticsChunk(),
              preloadChartsVendors(),
            ]);
            const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            console.info('[prefetch] analytics & charts chunks preloaded in', Math.round(t1 - t0), 'ms');
            if (typeof performance !== 'undefined') {
              performance.mark('analytics-prefetch-end');
              performance.measure('analytics-prefetch-duration', 'analytics-prefetch-start', 'analytics-prefetch-end');
            }
          }, 2, 600);
        } else {
          console.info('[prefetch] analytics chunk prefetch skipped due to low bandwidth/save-data');
        }

        await prefetchAnalyticsData();
        analyticsPreloaded = true;
        analyticsPrefetchAttempts = 0;
      } catch (err) {
        analyticsPreloaded = false;
        analyticsPrefetchAttempts += 1;
        console.warn('[prefetch] analytics prefetch attempt failed', err);
        if (analyticsPrefetchAttempts < MAX_PREFETCH_ATTEMPTS) {
          setTimeout(() => scheduleAnalyticsPrefetch(), 4000 * analyticsPrefetchAttempts);
        }
      } finally {
        analyticsPrefetchInFlight = false;
      }
    };
    run();
  });
}

export function scheduleAdminPrefetch() {
  if (adminPreloaded || adminPrefetchInFlight || adminPrefetchAttempts >= MAX_PREFETCH_ATTEMPTS) {
    return;
  }
  adminPrefetchInFlight = true;
  requestIdle(() => {
    const run = async () => {
      const deferHeavy = shouldDeferHeavyPrefetch();
      try {
        if (deferHeavy) {
          console.info('[prefetch] admin chunk prefetch skipped due to low bandwidth/save-data');
          return;
        }
        await withRetry(async () => {
          await Promise.all([
            preloadAdminWelcome(),
            preloadAdminStaffRegister(),
            preloadAdminModuleSettings(),
            preloadAdminUserEdit(),
            preloadAdminTenantsList(),
            preloadAdminTenantEdit(),
          ]);
        }, 2, 600);
        adminPreloaded = true;
        adminPrefetchAttempts = 0;
      } catch (err) {
        adminPreloaded = false;
        adminPrefetchAttempts += 1;
        console.warn('[prefetch] admin chunks prefetch failed', err);
        if (adminPrefetchAttempts < MAX_PREFETCH_ATTEMPTS) {
          setTimeout(() => scheduleAdminPrefetch(), 4000 * adminPrefetchAttempts);
        }
      } finally {
        adminPrefetchInFlight = false;
      }
    };
    run();
  });
}

// 3. React hook to be used where user intent suggests likely navigation

// Heuristics: when user visits dashboard or staff dashboard, prefetch analytics & charts in background.
export function useIdlePrefetch() {
  const loc = useLocation();
  useEffect(() => {
    if (loc.pathname === '/' || loc.pathname.startsWith('/staff')) {
      scheduleAnalyticsPrefetch();
      // Warm wash history after analytics
      preloadWashHistory().catch(() => {});
    }
    if (loc.pathname.startsWith('/admin')) {
      scheduleAdminPrefetch();
    }
  }, [loc.pathname]);
}
