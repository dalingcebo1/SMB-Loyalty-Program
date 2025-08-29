// src/features/staff/hooks/useActiveWashes.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';
import { Wash } from '../../../types';

/**
 * Fetches all active washes.
 */
export function useActiveWashes(pollMs: number = 10_000) {
  return useQuery<Wash[], Error>({
    queryKey: ['washes', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/payments/active-washes');
      return data as Wash[];
    },
    // Active list benefits from light polling to reflect progress; adjustable
    refetchInterval: pollMs,
    refetchOnWindowFocus: false,
    staleTime: pollMs / 2,
    meta: { description: 'Active washes with controlled polling (Phase 2)' }
  });
}
