import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

// Mock AuthProvider hook used by Login page
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    login: vi.fn(),
    socialLogin: vi.fn(),
  }),
}));

import Login from '../Login';

describe('Login social button (no Firebase config)', () => {
  it('disables Google sign-in button and shows hint text', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const btn = await screen.findByRole('button', { name: /continue with google/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/google sign-in is disabled/i)).toBeInTheDocument();
  });
});
