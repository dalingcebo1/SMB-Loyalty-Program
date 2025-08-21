// src/features/staff/hooks/useEndWash.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';

/**
 * Ends a wash and invalidates active washes cache.
 */
export function useEndWash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => api.post(`/payments/end-wash/${orderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washes', 'active'] });
    },
  });
}
