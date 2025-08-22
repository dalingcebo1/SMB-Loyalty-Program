// vite.config.ts
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
// Use named export for visualizer plugin
import { visualizer } from 'rollup-plugin-visualizer';
// PWA support for offline caching
// Import from dist for proper ESM resolution per package exports
import { VitePWA } from 'vite-plugin-pwa/dist/index.js';

export default defineConfig({
  // Include 'react-is' to satisfy recharts peer dependency
  optimizeDeps: {
    include: ['react-is'],
  },
  plugins: [
    react(),
    visualizer({ filename: 'bundle-stats.html', open: true, gzipSize: true, brotliSize: true }) as unknown as PluginOption,
    // PWA support for offline caching
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'SMB Loyalty',
        short_name: 'SMB',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }
        },
      },
    },
  },
  server: {
    // Temporarily remove COOP header to test popup behavior
    headers: {
      // "Cross-Origin-Opener-Policy": "same-origin",
      // "Cross-Origin-Embedder-Policy": "require-corp", // Already commented out to allow Yoco SDK
    },
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
