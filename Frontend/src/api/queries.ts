// src/api/queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';
import { queryKeys } from './queryClient';

// Mutation: start a wash (Phase 4: with optimistic updates)
export function useStartWash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, vehicleId }: { orderId: string; vehicleId: number }) =>
      api.post(`/payments/start-wash/${orderId}`, { vehicle_id: vehicleId }),
    onSuccess: () => {
      // Phase 4: Use consistent query keys from factory
      queryClient.invalidateQueries({ queryKey: queryKeys.washes.active });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.active });
    },
  });
}

// Fetch service catalog categories (Phase 4: optimized caching)
export function useServices() {
  return useQuery({
    // Phase 4: Use query key factory for consistency
    queryKey: queryKeys.catalog.services,
    queryFn: async () => {
      const { data } = await api.get<Record<string, import('../types').Service[]>>('/catalog/services');
      return data;
    },
    // Phase 4: Catalog data rarely changes, cache aggressively (matches backend Redis TTL)
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

// Fetch extras catalog (Phase 4: optimized caching)
export function useExtras() {
  return useQuery({
    // Phase 4: Use query key factory for consistency
    queryKey: queryKeys.catalog.extras,
    queryFn: async () => {
      const { data } = await api.get<import('../types').Extra[]>('/catalog/extras');
      return data;
    },
    // Phase 4: Catalog data rarely changes, cache aggressively (matches backend Redis TTL)
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

// Mutation: verify a payment, loyalty, or pos reference
export function useVerify() {
  return useMutation({
    mutationFn: async ({ referenceOrPin, paymentType }: { referenceOrPin: string; paymentType: 'payment' | 'loyalty' | 'pos' }) => {
      let url = '';
      if (paymentType === 'payment') {
        url = `/payments/verify-payment?${/^[a-zA-Z0-9]{4,8}$/.test(referenceOrPin) ? `pin=${referenceOrPin}` : `qr=${referenceOrPin}`}`;
      } else if (paymentType === 'loyalty') {
        url = `/payments/verify-loyalty?${/^[a-zA-Z0-9]{4,8}$/.test(referenceOrPin) ? `pin=${referenceOrPin}` : `qr=${referenceOrPin}`}`;
      } else {
        url = `/payments/verify-pos?receipt=${referenceOrPin}`;
      }
      const { data } = await api.get(url);
      return data;
    },
  });
}

export { useActiveWashes } from '../features/staff/hooks/useActiveWashes';
export { useEndWash } from '../features/staff/hooks/useEndWash';

// Query: fetch user and vehicles for a given order_id
export function useOrderUser(orderId?: string) {
  return useQuery({
    queryKey: ['orderUser', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/payments/order-user/${orderId}`);
      return data;
    },
    enabled: !!orderId,
  });
}
