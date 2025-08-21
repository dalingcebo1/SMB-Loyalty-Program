import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from './utils/test-utils';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
// Stub AuthProvider and useAuth for this test
vi.mock('./auth/AuthProvider', () => ({
  __esModule: true,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { id: 1, firstName: 'Test', lastName: 'User', email: '', phone: '', role: 'user' },
    loading: false,
    login: async () => ({}),
    signup: async () => ({}),
    loginWithToken: async () => ({}),
    logout: async () => {},
    refreshUser: async () => {},
  }),
}));
// Using AuthProvider from test-utils wrapper

// Import AuthProvider to wrap App for real auth context

// Mock API client to intercept /auth/me for auto-login
// Removed unused React and api imports
vi.mock('./api/api', async () => {
  // Import the real module for interceptors and other methods
  // Using generic to type importActual without any
  const actualModule = await vi.importActual<typeof import('./api/api')>('./api/api');
  const realApi = actualModule.default;
  // Create a mocked API instance based on the real one
  const apiMock = {
    ...realApi,
    get: vi.fn((path: string) => {
      if (path === '/auth/me') {
        return Promise.resolve({ data: { id: 1, email: 'test@example.com', phone: '1234567890', first_name: 'Test', last_name: 'User', role: 'user' } });
      }
      return Promise.resolve({ data: {} });
    }),
  };
  return {
    default: apiMock,
  };
});

describe('Auto-login flow', () => {
  beforeEach(() => {
    // Simulate token in localStorage
    localStorage.setItem('token', 'fake-jwt-token');
  });

  it('redirects to welcome page on valid token', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    // Ensure welcome heading appears after auth load
    const heading = await waitFor(() => screen.getByRole('heading', { name: /Welcome Test User/i }));
    expect(heading).toBeInTheDocument();
  });
});
