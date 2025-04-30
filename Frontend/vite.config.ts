// Frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/catalog':  { target: 'http://localhost:8000', changeOrigin: true },
      '/loyalty':  { target: 'http://localhost:8000', changeOrigin: true },
      '/orders':   { target: 'http://localhost:8000', changeOrigin: true },
      '/payments': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
