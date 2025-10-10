import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../api/api', () => {
  const get = vi.fn();
  return {
    default: {
      get,
    },
  };
});

import api from '../../../../api/api';
import { useRecentVerifications, useVerifyPayment } from '../usePaymentVerification';

type MockedApi = {
  get: ReturnType<typeof vi.fn>;
};

const mockedApi = api as unknown as MockedApi;

describe('usePaymentVerification hooks', () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = () => {
    const queryClient = new QueryClient();
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { Wrapper, queryClient };
  };

  it('fetches recent verifications from the relative payments endpoint', async () => {
    const sample = [{ order_id: '123', timestamp: '2025-10-10T00:00:00Z', status: 'success' as const }];
    mockedApi.get.mockResolvedValueOnce({ data: sample });

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useRecentVerifications(5), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.get).toHaveBeenCalledWith('/payments/recent-verifications', {
      params: { limit: 5 },
    });
    expect(result.current.data).toEqual(sample);

    queryClient.clear();
  });

  it('verifies payments by PIN without duplicating the /api prefix', async () => {
    const payload = { order_id: 'ord-1', status: 'ok' };
    mockedApi.get.mockResolvedValueOnce({ data: payload });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useVerifyPayment(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync({ token: '1234', type: 'pin' });

    expect(mockedApi.get).toHaveBeenCalledWith('/payments/verify-payment', {
      params: { pin: '1234' },
    });
    expect(response).toEqual(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['payments', 'recent-verifications'] });

    queryClient.clear();
  });

  it('verifies payments by reference token without duplicating the /api prefix', async () => {
    const payload = { order_id: 'ord-2', status: 'already_redeemed' };
    mockedApi.get.mockResolvedValueOnce({ data: payload });

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useVerifyPayment(), { wrapper: Wrapper });

    const response = await result.current.mutateAsync({ token: 'REF-999', type: 'ref' });

    expect(mockedApi.get).toHaveBeenCalledWith('/payments/verify-payment', {
      params: { ref: 'REF-999' },
    });
    expect(response).toEqual(payload);

    queryClient.clear();
  });
});
