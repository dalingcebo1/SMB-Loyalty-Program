// src/features/loyalty/hooks/useLoyalty.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface RewardReady {
  reward: string;
  expiry?: string;
  milestone?: number;
}

export interface LoyaltyResponse {
  points?: number;
  rewards_ready?: RewardReady[];
  // add other loyalty fields as needed
}

/**
 * Fetches the loyalty data for a given phone number.
 */
export function useLoyalty(phone: string) {
  return useQuery<LoyaltyResponse>({
    queryKey: ['loyalty', phone],
    queryFn: async () => {
      const { data } = await api.get<LoyaltyResponse>('/loyalty/me', { params: { phone } });
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}
