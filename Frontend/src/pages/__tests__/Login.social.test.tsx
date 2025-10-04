import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '../../utils/test-utils';

// Mock AuthProvider hook used by Login page
vi.mock('../../auth/AuthProvider', () => ({
  __esModule: true,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    login: vi.fn(),
    socialLogin: vi.fn(),
  }),
}));

vi.mock('../../firebase', () => ({
  isFirebaseEnabled: false,
}));

import Login from '../Login';

describe('Login social button (no Firebase config)', () => {
  it('disables Google sign-in button and shows hint text', async () => {
    render(<Login />);

    const btn = await screen.findByRole('button', { name: /continue with google/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/google sign-in is disabled/i)).toBeInTheDocument();
  });
});
