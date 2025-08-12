// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import api from "./api/api";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./firebase";
import "./index.css";

// Bootstraps React app with prefetched analytics summary for instant rendering
async function bootstrap() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  });
  // Prefetch analytics summary for default 7-day range
  const end = new Date().toISOString().slice(0,10);
  const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0,10);
  await queryClient.prefetchQuery({
    queryKey: ['analyticsSummary', start, end],
    queryFn: () => api.get(`/analytics/summary?start_date=${start}&end_date=${end}`).then(res => res.data),
  });
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AuthProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </ErrorBoundary>
      </AuthProvider>
    </React.StrictMode>
  );
}
bootstrap();
