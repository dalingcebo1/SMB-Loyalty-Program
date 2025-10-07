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
    // Only include visualizer in development to reduce build memory usage
    ...(process.env.NODE_ENV === 'development' ? [
      visualizer({ filename: 'bundle-stats.html', open: false, gzipSize: true, brotliSize: true }) as unknown as PluginOption
    ] : []),
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
    // Optimize build for memory efficiency
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false, // Disable sourcemaps to reduce memory usage
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Coarse grouping to reduce total chunk count for deployment limits
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router') || id.includes('/react-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('/@headlessui/') || id.includes('/framer-motion') || id.includes('/react-icons')) {
              return 'vendor-ui';
            }
            if (id.includes('/react-hook-form') || id.includes('/@hookform/') || id.includes('/zod/')) {
              return 'vendor-forms';
            }
            if (id.includes('/@tanstack/') || id.includes('/axios/')) {
              return 'vendor-data';
            }
            if (id.includes('/recharts') || id.includes('circular-progressbar')) {
              return 'vendor-analytics';
            }
            return 'vendor-shared';
          }

          if (id.includes('/src/pages/admin/')) {
            return 'admin-pages';
          }
          if (id.includes('/src/pages/staff/')) {
            return 'staff-pages';
          }
          if (id.includes('/src/pages/auth/')) {
            return 'auth-pages';
          }
          if (id.includes('/src/pages/')) {
            return 'app-pages';
          }
          if (id.includes('/src/features/admin/')) {
            return 'admin-features';
          }
          if (id.includes('/src/features/')) {
            return 'app-features';
          }
          if (id.includes('/src/components/ui/')) {
            return 'ui-kit';
          }
          if (id.includes('/src/components/')) {
            return 'shared-components';
          }
          if (id.includes('/src/utils/')) {
            return 'shared-utils';
          }

          return undefined;
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
