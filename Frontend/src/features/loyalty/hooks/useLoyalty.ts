// src/features/loyalty/hooks/useLoyalty.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';

export interface RewardReady {
  milestone: number;
  reward: string;
  qr_reference?: string;
  pin?: string;
  status?: string;
  expiry_at?: string;
}

export interface UpcomingReward {
  milestone: number;
  visits_needed: number;
  reward: string;
}

export interface LoyaltyResponse {
  name: string;
  phone: string;
  visits: number;
  rewards_ready: RewardReady[];
  upcoming_rewards: UpcomingReward[];
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
