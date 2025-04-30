import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // proxy EVERYTHING under /api/* to your FastAPI dev server
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
