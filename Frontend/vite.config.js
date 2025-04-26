import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // if you ever run locally
    host: true,
  },
  define: {
    // nothing here
  },
});
