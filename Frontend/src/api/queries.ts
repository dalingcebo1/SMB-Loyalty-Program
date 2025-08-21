// src/api/queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// Fetch all active washes
export function useActiveWashes() {
  return useQuery({
    queryKey: ['washes', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/payments/active-washes');
      return data as any;
    },
  });
}

// Mutation: start a wash
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

// Fetch service catalog categories
export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await api.get<Record<string, import('../types').Service[]>>('/catalog/services');
      return data;
    },
  });
}

// Fetch extras catalog
export function useExtras() {
  return useQuery({
    queryKey: ['extras'],
    queryFn: async () => {
      const { data } = await api.get<import('../types').Extra[]>('/catalog/extras');
      return data;
    },
  });
}

// Mutation: end a wash
export function useEndWash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => api.post(`/payments/end-wash/${orderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washes', 'active'] });
    },
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
// Query: fetch wash history with optional filters
export function useWashHistory(params: { startDate?: string; endDate?: string; paymentType?: string }) {
  return useQuery({
    queryKey: ['washes', 'history', params],
    queryFn: async () => {
      const { data } = await api.get('/payments/history', { params });
      return data as any[];
    },
  });
}
