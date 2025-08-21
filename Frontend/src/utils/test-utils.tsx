// src/utils/test-utils.tsx
/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { render as rtlRender } from '@testing-library/react';
// Remove BrowserRouter to let tests supply their own router (e.g. MemoryRouter)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthProvider';
import { ToastContainer } from 'react-toastify';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
    <ToastContainer />
    {children}
      </QueryClientProvider>
    </AuthProvider>
  );
}

export function render(ui: React.ReactElement, options = {}) {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
