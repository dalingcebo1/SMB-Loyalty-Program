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

// Bootstraps React app with prefetched analytics summary for instant rendering
import { queryClient } from './api/queryClient';
async function bootstrap() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <TenantConfigProvider>
          <AuthProvider>
            <ErrorBoundary>
              <QueryClientProvider client={queryClient}>
                <App />
              </QueryClientProvider>
            </ErrorBoundary>
          </AuthProvider>
        </TenantConfigProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
bootstrap();
