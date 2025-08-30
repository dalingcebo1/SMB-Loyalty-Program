// src/features/staff/hooks/useEndWash.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';

/**
 * Ends a wash and invalidates active washes cache.
 */
export interface EndWashResponse {
  status: 'ended' | 'already_completed';
  order_status?: string;
  order_id: string;
  ended_at?: string;
  duration_seconds?: number | null;
}

export function useEndWash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<EndWashResponse> => {
      const { data } = await api.post(`/payments/end-wash/${orderId}`);
      return data as EndWashResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washes', 'active'] });
  queryClient.invalidateQueries({ queryKey: ['washes', 'history'] });
      // Optionally cache duration somewhere or trigger toast here
    },
  });
}
