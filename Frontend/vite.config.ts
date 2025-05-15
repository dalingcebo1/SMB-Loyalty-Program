// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // ✨ Add these headers so popups can close themselves cleanly
    headers: {
     // "Cross-Origin-Opener-Policy": "same-origin",
     // "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      // your existing API proxy
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
