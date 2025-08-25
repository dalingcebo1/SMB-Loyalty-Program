// src/features/staff/hooks/useWashHistory.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';
import { Wash } from '../../../types';

/**
 * Fetches wash history with optional filter parameters.
 */
export function useWashHistory(params?: { startDate?: string; endDate?: string; paymentType?: string }) {
  return useQuery({
    queryKey: ['washes', 'history', params],
    queryFn: async () => {
      const { data } = await api.get('/payments/history', { params });
      return data as Wash[];
    },
  });
}
