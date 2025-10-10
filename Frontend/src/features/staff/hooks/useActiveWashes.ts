// src/features/staff/hooks/useActiveWashes.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';
import { Wash } from '../../../types';

interface ActiveWashesOptions {
  refetchIntervalMs?: number;
  enabled?: boolean;
}

/**
 * Fetches all active washes with optional polling control.
 */
export function useActiveWashes(options: ActiveWashesOptions = {}) {
  const { refetchIntervalMs = 10_000, enabled = true } = options;
  const interval = refetchIntervalMs && refetchIntervalMs > 0 ? refetchIntervalMs : false;

  return useQuery<Wash[], Error>({
    queryKey: ['washes', 'active'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get('/payments/active-washes');
      return Array.isArray(data) ? (data as Wash[]) : [];
    },
    // Active list benefits from polling to reflect progress; allow disable
    refetchInterval: interval,
    refetchOnWindowFocus: false,
    staleTime: interval && typeof interval === 'number' ? interval / 2 : 5_000,
    placeholderData: [] as Wash[],
    meta: { description: 'Active washes with adjustable polling cadence' }
  });
}
