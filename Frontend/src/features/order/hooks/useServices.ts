// src/features/order/hooks/useServices.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface Service {
  id: number;
  name: string;
  base_price: number;
}

/**
 * Fetches service catalog categorized by category name.
 */
export function useServices() {
  return useQuery<Record<string, Service[]>>({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await api.get('/catalog/services');
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
