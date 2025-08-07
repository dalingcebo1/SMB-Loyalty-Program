// vite.config.ts
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
// Use named export for visualizer plugin
import { visualizer } from 'rollup-plugin-visualizer';
// @ts-ignore: Missing type declarations for VitePWA plugin
// PWA support for offline caching
// Import from dist for proper ESM resolution per package exports
import { VitePWA } from 'vite-plugin-pwa/dist/index.js';

export default defineConfig({
  plugins: [
    react(),
    // @ts-ignore: Rollup plugin types differ slightly from Vite PluginOption
    visualizer({ filename: 'bundle-stats.html', open: true, gzipSize: true, brotliSize: true }) as unknown as PluginOption,
    // PWA support for offline caching
    // @ts-ignore: plugin type mismatch
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
    // ✨ Add these headers so popups can close themselves cleanly
    headers: {
      // "Cross-Origin-Opener-Policy": "same-origin",
      // "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
