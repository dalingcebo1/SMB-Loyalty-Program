import axios from "axios";

const api = axios.create({
  // in dev this’ll be "/api", in prod you can override via VITE_API_URL
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

export default api;
