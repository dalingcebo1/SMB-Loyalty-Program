// src/App.tsx

// React import not required for JSX automatic runtime
// import React from 'react';

// App shell just mounts the unified route config handled by useRoutes in routes/index.tsx
import AppRoutes from './routes';
import { useIdlePrefetch } from './prefetch';
import { OfflineBanner, InstallPromptBanner, useTenantManifest } from './pwa';

export default function App() {
  useIdlePrefetch(); // schedule background chunk/data prefetches based on route heuristics
  useTenantManifest(); // inject tenant-branded manifest from backend
  return (
    <div className="app-shell">
      <OfflineBanner />
      <AppRoutes />
      <InstallPromptBanner />
    </div>
  );
}
