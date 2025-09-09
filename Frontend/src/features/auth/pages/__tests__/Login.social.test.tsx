import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

vi.mock('../../../auth/AuthProvider', () => ({
  useAuth: () => ({
    login: vi.fn(),
    socialLogin: vi.fn(),
  }),
}));

import Login from '../Login';

describe.skip('Feature-auth Login social button (no Firebase config)', () => {
  it('disables Google sign-in and shows hint', async () => {
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
