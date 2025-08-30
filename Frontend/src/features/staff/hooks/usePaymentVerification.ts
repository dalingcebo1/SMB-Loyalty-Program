import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';

export interface VerificationRecord {
  order_id: string | number;
  timestamp: string;
  status: 'success' | 'failed';
  amount?: number;
  payment_method?: string | null;
  payment_reference?: string | null;
  started?: boolean;
  completed?: boolean;
  user?: { first_name?: string; last_name?: string; phone?: string };
  vehicle?: { id?: number; make?: string; model?: string; reg?: string };
}

export interface VerifiedPaymentDetails {
  order_id: string;
  status: string; // ok | already_redeemed | failed
  amount?: number;
  payment_method?: string;
  service_name?: string;
  extras?: string[];
  timestamp?: string;
  user?: { id: number; first_name: string; last_name: string; phone: string };
  vehicle?: { id: number; reg: string; make: string; model: string };
  available_vehicles?: { id: number; reg: string; make: string; model: string }[];
}

export function useRecentVerifications(limit = 10, enabled = true) {
  return useQuery<VerificationRecord[], Error>({
    queryKey: ['payments','recent-verifications', limit],
    enabled,
    refetchInterval: 10_000, // auto-refresh
    queryFn: async () => {
      const { data } = await api.get('/payments/recent-verifications', { params: { limit } });
      return data as VerificationRecord[];
    }
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation<VerifiedPaymentDetails, Error, { token: string; type: 'pin' | 'ref' }>({
    mutationFn: async ({ token, type }: { token: string; type: 'pin' | 'ref' }) => {
      const params = type === 'pin' ? { pin: token } : { ref: token };
      const { data } = await api.get('/payments/verify-payment', { params });
      return data as VerifiedPaymentDetails;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments','recent-verifications'] });
    }
  });
}
