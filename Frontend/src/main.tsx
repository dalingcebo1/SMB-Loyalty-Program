// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { TenantConfigProvider } from './config/TenantConfigProvider';
import ErrorBoundary from "./components/ErrorBoundary";
// api import removed: unused
import { QueryClientProvider } from "@tanstack/react-query";

import "./firebase";
import "./index.css";
import "./styles/user-app.css";
import './api/fetchShim';

// Bootstraps React app with prefetched analytics summary for instant rendering
import { queryClient } from './api/queryClient';
import { useTenantTheme } from './branding/useTenantTheme';
export const RootWithTheme: React.FC = () => {
  // Hook triggers side-effects to inject CSS vars & favicon
  useTenantTheme();
  return <App />;
};

const CHUNK_RECOVERY_FLAG = 'chunk-reload-attempted';
const CHUNK_ERROR_PATTERNS = [
  'Unable to preload CSS',
  'Loading chunk',
  'ChunkLoadError',
  'failed to fetch dynamically imported module',
  'Importing a module script failed',
  'dynamically imported module',
];

const isChunkLoadError = (value: unknown): boolean => {
  if (!value) return false;
  if (value instanceof Error) {
    return isChunkLoadError(value.message);
  }
  const message = typeof value === 'string' ? value : undefined;
  if (!message && typeof value === 'object' && 'message' in (value as Record<string, unknown>)) {
    return isChunkLoadError(String((value as { message?: unknown }).message));
  }
  if (!message) return false;
  return CHUNK_ERROR_PATTERNS.some(pattern => message.toLowerCase().includes(pattern.toLowerCase()));
};

const triggerHardReload = (reason: string) => {
  if (typeof window === 'undefined') return;
  const alreadyAttempted = window.sessionStorage.getItem(CHUNK_RECOVERY_FLAG) === '1';
  if (alreadyAttempted) {
    return;
  }
  try {
    window.sessionStorage.setItem(CHUNK_RECOVERY_FLAG, '1');
  } catch (err) {
    console.warn('[runtime] unable to persist chunk reload flag', err);
  }
  console.warn('[runtime] reloading due to asset load failure:', reason);
  window.location.reload();
};

if (typeof window !== 'undefined') {
  if (window.sessionStorage.getItem(CHUNK_RECOVERY_FLAG) === '1') {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_FLAG);
  }

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event?.message) || isChunkLoadError(event?.error)) {
      event.preventDefault();
      triggerHardReload(event?.message || 'chunk load error');
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event?.reason)) {
      event.preventDefault();
      triggerHardReload(typeof event.reason === 'string' ? event.reason : 'chunk load rejection');
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(reg => reg.unregister().catch(() => false))))
        .catch(() => undefined);
    }, { once: true });
  }
}

async function bootstrap() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QueryClientProvider client={queryClient}>
          <TenantConfigProvider>
            <AuthProvider>
              <ErrorBoundary>
                <RootWithTheme />
              </ErrorBoundary>
            </AuthProvider>
          </TenantConfigProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
bootstrap();
