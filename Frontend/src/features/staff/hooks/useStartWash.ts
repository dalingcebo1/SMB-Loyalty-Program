// src/features/staff/hooks/useStartWash.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';

/**
 * Starts a wash and invalidates active washes cache.
 */
export function useStartWash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, vehicleId }: { orderId: string; vehicleId: number }) =>
      api.post(`/payments/start-wash/${orderId}`, { vehicle_id: vehicleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washes', 'active'] });
    },
  });
}
