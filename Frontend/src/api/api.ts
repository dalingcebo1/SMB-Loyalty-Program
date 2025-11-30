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
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    // Global 401 handler
  if (status === 401) {
      // Only force logout on auth errors, not on other protected endpoints
      const url = err.config.url || '';
      if (url.includes('/auth/')) {
        localStorage.removeItem('token');
  notifyErrorKey('notifications.session.expired');
        window.location.href = '/login';
      }
      return Promise.reject(err);
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
