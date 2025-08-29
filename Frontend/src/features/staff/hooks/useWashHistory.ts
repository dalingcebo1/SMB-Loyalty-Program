// src/features/staff/hooks/useWashHistory.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../../api/api';
import { Wash } from '../../../types';

export interface WashHistoryParams {
  startDate?: string;
  endDate?: string;
  status?: string;
  serviceType?: string;
  customerSearch?: string;
  page?: number;
  limit?: number;
  paymentType?: string;
}

/** Fetch wash history (wraps /payments/history). */
export function useWashHistory(params?: WashHistoryParams) {
  return useQuery<Wash[]>({
    queryKey: ['washes', 'history', params],
    queryFn: async () => {
      const mapped: {
        start_date?: string;
        end_date?: string;
        status?: string;
        service_type?: string;
        customer?: string;
        page?: number;
        limit?: number;
        paymentType?: string;
      } = {};
      if (params?.startDate) mapped.start_date = params.startDate;
      if (params?.endDate) mapped.end_date = params.endDate;
      if (params?.status) mapped.status = params.status;
      if (params?.serviceType) mapped.service_type = params.serviceType;
      if (params?.customerSearch) mapped.customer = params.customerSearch;
      if (params?.page) mapped.page = params.page;
      if (params?.limit) mapped.limit = params.limit;
      if (params?.paymentType) mapped.paymentType = params.paymentType;
      const { data } = await api.get('/payments/history', { params: mapped });
      return (data.items || data) as Wash[];
    },
  });
}
