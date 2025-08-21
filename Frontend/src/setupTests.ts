// src/setupTests.ts
// Mock ToastContainer to avoid timer-related hangs in tests
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
// Partial react-hook-form mock: preserve actual exports for FormProvider and Controller
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual<typeof import('react-hook-form')>('react-hook-form');
  return {
    ...actual,
    useForm: actual.useForm,
    FormProvider: actual.FormProvider,
    Controller: actual.Controller,
  };
});

// stub react-toastify to prevent timers and DOM insertion

// Stub react-toastify to prevent timers and DOM insertion
vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Note: react-hook-form is partially mocked above to maintain actual controllers

// Stub focus-trap-react so focus traps just render children
vi.mock('focus-trap-react', () => ({
  __esModule: true,
  default: (props: { children: ReactNode }) => props.children,
}));

// Stub createPortal so portals render inline
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    createPortal: (node: ReactNode) => node,
  };
});

// Stub AuthProvider and useAuth to provide a dummy user
vi.mock('../auth/AuthProvider', () => {
  const dummyUser = {
    id: 1,
    email: 'test@example.com',
    phone: '123',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
  };
  return {
    __esModule: true,
    AuthProvider: (props: { children: ReactNode }) => props.children,
    useAuth: () => ({
      user: dummyUser,
      loading: false,
      login: async () => dummyUser,
      signup: async () => dummyUser,
      loginWithToken: async () => dummyUser,
      logout: async () => {},
      refreshUser: async () => {},
    }),
  };
});
