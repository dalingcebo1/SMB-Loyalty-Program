// src/features/staff/hooks/useActiveWashes.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';
import { Wash } from '../../../types';

/**
 * Fetches all active washes.
 */
export function useActiveWashes() {
  return useQuery({
    queryKey: ['washes', 'active'],
    queryFn: async () => {
      const { data } = await api.get('/payments/active-washes');
      return data as Wash[];
    },
  });
}
