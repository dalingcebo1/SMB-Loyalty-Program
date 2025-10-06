// src/api/api.ts
import axios from "axios";

// Ensure all requests hit the backend's /api prefix.
// If VITE_API_BASE_URL is absolute (e.g. https://api.chaosx.co.za), append /api (avoiding double).
// If unset, fall back to relative '/api' (useful for local dev or reverse proxy setups).
function computeBaseURL() {
  const raw = import.meta.env?.VITE_API_BASE_URL ?? "";
  const trimmed = raw.replace(/\/+$/g, "");
  if (!trimmed) return "/api";
  if (trimmed.endsWith("/api")) return trimmed; // already includes /api
  return `${trimmed}/api`;
}

const api = axios.create({
  baseURL: computeBaseURL(),
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
