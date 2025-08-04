import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock AuthProvider to avoid real API calls and loading state
vi.mock('./auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: async () => {},
    signup: async () => {},
    loginWithToken: async () => {},
    logout: async () => {},
    refreshUser: async () => {},
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('App routing', () => {
  it('renders login page when navigating to /login', () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>
    );
    // Check that the login heading is rendered
    const heading = screen.getByRole('heading', { name: /Log In/i });
    expect(heading).toBeInTheDocument();
  });
});
