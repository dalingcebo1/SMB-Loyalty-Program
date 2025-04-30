// Frontend/src/api/api.ts
import axios from 'axios';

export const api = axios.create({
  // no baseURL here ⇒ use relative URLs like "/catalog/services"
});

// attach Bearer token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
