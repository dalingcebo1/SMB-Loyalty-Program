import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy all API calls to the FastAPI backend
    proxy: {
      '/catalog': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/loyalty': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/orders': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/payments': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
