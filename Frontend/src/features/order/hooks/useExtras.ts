// src/features/order/hooks/useExtras.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface Extra {
  id: number;
  name: string;
  price_map: Record<string, number>;
}

/**
 * Fetches available extras list.
 */
export function useExtras() {
  return useQuery<Extra[]>({
    queryKey: ['extras'],
    queryFn: async () => {
      const { data: raw } = await api.get<Extra[]>('/catalog/extras');
      return Array.from(new Map(raw.map(e => [e.id, e])).values());
    },
    staleTime: 1000 * 60 * 5,
  });
}
