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

let analyticsPreloaded = false;
let adminPreloaded = false;
export function scheduleAnalyticsPrefetch() {
  if (analyticsPreloaded) return;
  analyticsPreloaded = true;
  if (typeof performance !== 'undefined') {
    performance.mark('analytics-prefetch-start');
  }
  requestIdle(() => {
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    Promise.all([
      preloadAnalyticsChunk(),
      preloadChartsVendors(),
    ])
      .then(() => {
        const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        console.info('[prefetch] analytics & charts chunks preloaded in', Math.round(t1 - t0), 'ms');
        if (typeof performance !== 'undefined') {
          performance.mark('analytics-prefetch-end');
          performance.measure('analytics-prefetch-duration', 'analytics-prefetch-start', 'analytics-prefetch-end');
        }
      })
      .catch(err => {
        console.warn('[prefetch] analytics prefetch failed', err);
      });
  });
}

export function scheduleAdminPrefetch() {
  if (adminPreloaded) return;
  adminPreloaded = true;
  requestIdle(() => {
    Promise.all([
      preloadAdminWelcome(),
      preloadAdminStaffRegister(),
      preloadAdminModuleSettings(),
      preloadAdminUserEdit(),
      preloadAdminTenantsList(),
      preloadAdminTenantEdit(),
    ]).catch(err => console.warn('[prefetch] admin chunks prefetch failed', err));
  });
}

// 3. React hook to be used where user intent suggests likely navigation
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Heuristics: when user visits dashboard or staff dashboard, prefetch analytics & charts in background.
export function useIdlePrefetch() {
  const loc = useLocation();
  useEffect(() => {
    if (loc.pathname === '/' || loc.pathname.startsWith('/staff')) {
      scheduleAnalyticsPrefetch();
  // Warm wash history after analytics
  preloadWashHistory().catch(()=>{});
    }
    if (loc.pathname.startsWith('/admin')) {
      scheduleAdminPrefetch();
    }
  }, [loc.pathname]);
}
