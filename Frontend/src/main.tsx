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
import './api/fetchShim';

// Bootstraps React app with prefetched analytics summary for instant rendering
import { queryClient } from './api/queryClient';
import { useTenantTheme } from './branding/useTenantTheme';
export const RootWithTheme: React.FC = () => {
  // Hook triggers side-effects to inject CSS vars & favicon
  useTenantTheme();
  return <App />;
};

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
