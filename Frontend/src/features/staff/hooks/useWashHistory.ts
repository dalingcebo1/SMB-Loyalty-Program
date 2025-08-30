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
  return useQuery<Wash[], Error>({
    queryKey: ['washes', 'history', params],
    enabled: !(params && params.startDate && params.endDate && params.startDate > params.endDate),
  // Maintain previous-like data during refetch (v5 replacement for keepPreviousData)
  placeholderData: (previous) => previous ?? [],
    // History doesn't change second-to-second; allow brief caching window
    staleTime: 30_000, // 30s
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
    // Select: ensure only minimal shape (if further trimming needed, implement map)
    select: (data) => data,
    meta: { description: 'Wash history with caching & minimal re-renders (Phase 2)' }
  });
}

// Paged variant returning total + pagination metadata (staff UI usage)
export interface PagedWashHistoryResult {
  items: Wash[];
  total: number;
  page: number;
  limit: number;
}

export function usePagedWashHistory(params: WashHistoryParams) {
  return useQuery<PagedWashHistoryResult, Error>({
    queryKey: ['washes','history','paged', params],
    enabled: !(params.startDate && params.endDate && params.startDate > params.endDate),
    staleTime: 30_000,
    queryFn: async () => {
  const mapped: Record<string, unknown> = {};
      if (params.startDate) mapped.start_date = params.startDate;
      if (params.endDate) mapped.end_date = params.endDate;
      if (params.status) mapped.status = params.status;
      if (params.serviceType) mapped.service_type = params.serviceType;
      if (params.customerSearch) mapped.customer = params.customerSearch;
      if (params.page) mapped.page = params.page;
      if (params.limit) mapped.limit = params.limit;
      if (params.paymentType) mapped.paymentType = params.paymentType;
      const { data } = await api.get('/payments/history', { params: mapped });
      if (Array.isArray(data)) {
        return { items: data as Wash[], total: data.length, page: params.page || 1, limit: params.limit || data.length };
      }
      return {
        items: data.items || [],
        total: data.total ?? (data.items?.length || 0),
        page: data.page || params.page || 1,
        limit: data.limit || params.limit || (data.items?.length || 0)
      };
    },
  });
}
