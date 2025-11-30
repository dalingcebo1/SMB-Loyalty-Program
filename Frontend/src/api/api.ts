// src/api/api.ts
import axios from "axios";

// Ensure all requests hit the backend's /api prefix.
// Prefer VITE_API_BASE_URL_DEV when present (used by dev/preview deployments),
// otherwise fall back to VITE_API_BASE_URL. If neither is set, use relative '/api'.
function isLocalHost(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    // Not an absolute URL, check simple patterns
    const lower = url.toLowerCase();
    return lower.includes('localhost') || lower.includes('127.0.0.1');
  }
}

function computeBaseURL() {
  const raw =
    import.meta.env?.VITE_API_BASE_URL_DEV ??
    import.meta.env?.VITE_API_BASE_URL ??
    "";
  const trimmed = raw.replace(/\/+$/g, "");
  // Safety: never use localhost/127.0.0.1 when running on a non-local host
  const isBrowser = typeof window !== 'undefined';
  const onLocalHost = isBrowser && ['localhost','127.0.0.1'].includes(window.location.hostname);
  if (trimmed && isLocalHost(trimmed) && !onLocalHost) {
    return "/api";
  }
  if (!trimmed) return "/api";
  if (trimmed.endsWith("/api")) return trimmed; // already includes /api
  return `${trimmed}/api`;
}

const resolvedBase = computeBaseURL();
if (typeof window !== 'undefined') {
  console.log('═══════════════════════════════════════════');
  console.log('[API CONFIG] Resolved baseURL:', resolvedBase);
  console.log('[API CONFIG] window.location.hostname:', window.location.hostname);
  console.log('[API CONFIG] VITE_API_BASE_URL:', import.meta.env?.VITE_API_BASE_URL);
  console.log('[API CONFIG] VITE_API_BASE_URL_DEV:', import.meta.env?.VITE_API_BASE_URL_DEV);
  console.log('[API CONFIG] VITE_APP_VERSION:', import.meta.env?.VITE_APP_VERSION);
  console.log('═══════════════════════════════════════════');
}
const api = axios.create({
  baseURL: resolvedBase,
});

const ABSOLUTE_URL = /^[a-z]+:\/\//i;

// Collapse accidental /api prefixes so shared baseURL does not produce /api/api/...
function normalizeRelativePath(url: string): string {
  const withLeadingSlash = url.startsWith("/") ? url : `/${url}`;
  if (withLeadingSlash === "/api") return "/";
  if (withLeadingSlash.startsWith("/api/")) {
    return `/${withLeadingSlash.slice(5)}`.replace(/\/+/g, "/");
  }
  return withLeadingSlash;
}

// --- AUTH HEADER INTERCEPTOR ---
api.interceptors.request.use((config) => {
  if (config.url && !ABSOLUTE_URL.test(config.url)) {
    config.url = normalizeRelativePath(config.url);
  }
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  // Add default tenant ID for dev environment
  if (config.headers) {
    config.headers["X-Tenant-ID"] = "default";
  }
  return config;
});
// --- DEBUGGING INTERCEPTORS ---
api.interceptors.request.use((req) => {
  console.log("[API Request]", {
    url: (req.baseURL ?? "") + req.url,
    method: req.method,
    headers: req.headers,
    data: req.data,
  });
  return req;
});

import { notifyErrorKey } from '../utils/notifications';

// Helper to navigate without full page reload (avoids SWA 404s)
function navigateToLogin() {
  localStorage.removeItem('token');
  delete api.defaults.headers.common["Authorization"];
  // Use pushState for SPA navigation instead of full reload
  window.history.pushState({}, '', '/login');
  // Dispatch popstate to trigger React Router
  window.dispatchEvent(new PopStateEvent('popstate'));
  // Fallback: if router doesn't pick it up, do full reload after delay
  setTimeout(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, 100);
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config.url || '';
    
    // Global 401 handler - session expired or invalid token
    if (status === 401) {
      // Only force logout on auth errors, not on other protected endpoints
      if (url.includes('/auth/')) {
        notifyErrorKey('notifications.session.expired');
        navigateToLogin();
      }
      return Promise.reject(err);
    }
    
    // Global 403 handler - permission denied or wrong account
    if (status === 403) {
      const errorDetail = err.response?.data?.detail;
      
      // Check if this is a permission/role mismatch
      if (errorDetail && typeof errorDetail === 'string') {
        if (errorDetail.toLowerCase().includes('permission') || 
            errorDetail.toLowerCase().includes('not authorized') ||
            errorDetail.toLowerCase().includes('access denied')) {
          // Show a friendly message about switching accounts
          console.warn('[API] Permission denied - possible account mismatch');
          
          // Create a notification banner
          const banner = document.createElement('div');
          banner.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FEE2E2;
            border: 1px solid #EF4444;
            color: #991B1B;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
            font-family: system-ui, -apple-system, sans-serif;
          `;
          banner.innerHTML = `
            <div style="display: flex; align-items: start; gap: 12px;">
              <svg style="width: 24px; height: 24px; flex-shrink: 0; margin-top: 2px;" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">Access Denied</div>
                <div style="font-size: 14px; line-height: 1.5; margin-bottom: 12px;">
                  You don't have permission to access this resource. This may happen if you're logged in with the wrong account.
                </div>
                <button onclick="(function(){localStorage.removeItem('token');delete window.apiClient?.defaults?.headers?.common?.['Authorization'];window.history.pushState({},'','/login');window.dispatchEvent(new PopStateEvent('popstate'));setTimeout(()=>{if(window.location.pathname!=='/login')window.location.href='/login'},100)})();" 
                        style="background: #DC2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                  Log out and try a different account
                </button>
              </div>
              <button onclick="this.parentElement.parentElement.remove()" 
                      style="background: none; border: none; cursor: pointer; padding: 0; color: #991B1B; font-size: 20px; line-height: 1; margin-top: -4px;">
                ×
              </button>
            </div>
          `;
          document.body.appendChild(banner);
          
          // Auto-remove after 10 seconds
          setTimeout(() => banner.remove(), 10000);
        }
      }
    }
    
    console.error('[API Response Error]', {
      url: err.config.baseURL + err.config.url,
      status,
      data: err.response?.data,
      headers: err.response?.headers,
    });
    return Promise.reject(err);
  }
);
// --- END DEBUGGING ---

export default api;
/**
 * Builds a query string from an object, e.g. {a: '1', b: '2'} => '?a=1&b=2'
 */
export function buildQuery(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : '';
}
// Log timing from backend X-Query-Duration-ms header
api.interceptors.response.use(res => {
  const dur = res.headers['x-query-duration-ms'];
  if (dur) console.debug(`[API] ${res.config.url} took ${dur} ms`);
  return res;
});
