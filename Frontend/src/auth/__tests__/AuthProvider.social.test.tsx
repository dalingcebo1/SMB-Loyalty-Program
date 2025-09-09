import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../firebase', () => ({
  isFirebaseEnabled: false,
  auth: undefined,
}));

import { AuthProvider, useAuth } from '../AuthProvider';

describe('AuthProvider.socialLogin guard', () => {
  it('throws a friendly error when Firebase is disabled', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(result.current.socialLogin()).rejects.toThrow(/missing Firebase configuration/i);
  });
});
