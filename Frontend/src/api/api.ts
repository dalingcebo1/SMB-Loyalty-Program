// src/api/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
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
