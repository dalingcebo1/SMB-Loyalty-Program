// src/features/loyalty/hooks/useLoyalty.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';
import { normalizeLoyaltyResponse, NormalizedLoyalty } from '../../../utils/loyalty';

// Legacy interfaces retained for now (can be removed after migration)
export interface RewardReadyLegacy {
  milestone: number;
  reward: string;
  qr_reference?: string;
  pin?: string;
  status?: string;
  expiry_at?: string;
}
export interface UpcomingRewardLegacy {
  milestone: number;
  visits_needed: number;
  reward: string;
}
export interface LoyaltyResponseLegacy {
  name: string;
  phone: string;
  visits: number;
  rewards_ready: RewardReadyLegacy[];
  upcoming_rewards: UpcomingRewardLegacy[];
}

/**
 * Fetches the loyalty data for a given phone number.
 */
export function useLoyalty(phone: string) {
  return useQuery<NormalizedLoyalty>({
    queryKey: ['loyalty', phone],
    queryFn: async () => {
      const { data } = await api.get('/loyalty/me', { params: { phone } });
      return normalizeLoyaltyResponse(data);
    },
    staleTime: 1000 * 60 * 5,
  });
}
