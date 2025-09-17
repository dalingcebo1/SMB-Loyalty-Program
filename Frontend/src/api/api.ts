// src/api/api.ts
import axios from "axios";

// Normalize base URL to ensure it includes the '/api' path segment.
// This avoids calling backend endpoints without the required '/api' prefix in production.
function resolveApiBaseURL(): string {
  const raw = (import.meta.env as any).VITE_API_BASE_URL as string | undefined;
  // Default to relative '/api' for local dev / SWA rewrites
  if (!raw) return "/api";
  try {
    // Support absolute URLs and tolerate missing scheme by providing window origin as base
    const u = new URL(raw, window.location.origin);
    // Strip trailing slashes
    const cleanPath = u.pathname.replace(/\/+$/, "");
    // Append '/api' if not already present at the end
    if (!cleanPath.endsWith("/api")) {
      u.pathname = `${cleanPath}/api`;
    }
    // Drop any trailing slash for consistency
    return u.toString().replace(/\/+$/, "");
  } catch {
    // Fallback for malformed values; treat as path and ensure '/api' suffix
    const p = raw.replace(/\/+$/, "");
    return p.endsWith("/api") ? p : `${p}/api`;
  }
}

const api = axios.create({
  baseURL: resolveApiBaseURL(),
});

// --- AUTH HEADER INTERCEPTOR ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
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

import { toast } from 'react-toastify';
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
        toast.error('Session expired. Please log in again.');
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
