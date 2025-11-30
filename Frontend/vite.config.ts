// vite.config.ts
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
// Use named export for visualizer plugin
import { visualizer } from 'rollup-plugin-visualizer';
// PWA support for offline caching
// Import from dist for proper ESM resolution per package exports
import { VitePWA } from 'vite-plugin-pwa/dist/index.js';

function resolveApiBaseUrl(): string | undefined {
  const explicitDev = process.env.VITE_API_BASE_URL_DEV;
  if (explicitDev && explicitDev.trim().length > 0) {
    return explicitDev.trim();
  }
  return process.env.VITE_API_BASE_URL;
}

// Ensure Vite sees the correct API base at build time
const resolvedApiBase = resolveApiBaseUrl();
if (resolvedApiBase) {
  process.env.VITE_API_BASE_URL = resolvedApiBase;
}

export default defineConfig({
  // Include 'react-is' to satisfy recharts peer dependency
  optimizeDeps: {
    include: ['react-is'],
  },
  plugins: [
    react(),
    // Only include visualizer in development to reduce build memory usage
    ...(process.env.NODE_ENV === 'development' ? [
      visualizer({ filename: 'bundle-stats.html', open: false, gzipSize: true, brotliSize: true }) as unknown as PluginOption
    ] : []),
    // PWA support for offline caching
    VitePWA({
      registerType: 'autoUpdate',
      selfDestroying: true,
      workbox: {
        // Don't cache navigation requests to always fetch fresh index.html
        navigateFallback: undefined,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          }
        ]
      },
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
    // Optimize build for memory efficiency
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false, // Disable sourcemaps to reduce memory usage
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: false,
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
