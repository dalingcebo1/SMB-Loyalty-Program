import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Import AuthProvider to wrap App for real auth context
import { AuthProvider } from './auth/AuthProvider';

// Mock API client to intercept /auth/me for auto-login
import api from './api/api';
vi.mock('./api/api', async () => {
  // Import the real module for interceptors and other methods
  // Import the real module to preserve interceptors
  const actualModule = (await vi.importActual('./api/api')) as any;
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
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    );
    // Ensure welcome heading appears after auth load
    const heading = await waitFor(() => screen.getByRole('heading', { name: /Welcome Test User/i }));
    expect(heading).toBeInTheDocument();
  });
});
