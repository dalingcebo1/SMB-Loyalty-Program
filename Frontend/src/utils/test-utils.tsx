// src/utils/test-utils.tsx
/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { TenantConfigContext } from '../config/TenantConfigProvider';
import { getModuleFlags } from '../config/modules';
import ToastProvider from '../components/ToastProvider';
import { ROUTER_FUTURE_FLAGS } from '../router/futureFlags';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const tenantConfigValue = {
  loading: false,
  error: undefined,
  tenantId: 'test-tenant',
  vertical: 'carwash' as const,
  moduleFlags: getModuleFlags(),
  features: {},
  branding: {},
  refresh: () => {},
};

interface AllProvidersProps {
  children: React.ReactNode;
  routerProps?: MemoryRouterProps;
}

function AllProviders({ children, routerProps }: AllProvidersProps) {
  const mergedRouterProps: MemoryRouterProps = {
    ...(routerProps ?? {}),
    future: {
      ...ROUTER_FUTURE_FLAGS,
      ...(routerProps?.future ?? {}),
    },
  };

  return (
    <MemoryRouter {...mergedRouterProps}>
      <TenantConfigContext.Provider value={tenantConfigValue}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>{children}</ToastProvider>
          </QueryClientProvider>
        </AuthProvider>
      </TenantConfigContext.Provider>
    </MemoryRouter>
  );
}

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  routerProps?: MemoryRouterProps;
};

export function render(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { routerProps, ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AllProviders routerProps={routerProps}>{children}</AllProviders>;
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from '@testing-library/react';
