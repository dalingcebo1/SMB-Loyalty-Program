// Frontend/src/api/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://laughing-space-trout-pgv46w7pw97h7vv-8000.app.github.dev/",
});

// Attach JWT from localStorage (if present)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

