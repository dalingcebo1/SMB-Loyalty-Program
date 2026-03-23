import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { retailApi } from '../../../api/verticals/retail';
import { toastApiError, toastSuccess } from '../../../utils/apiErrors';
import type { PaginationParams } from '../../../types/api';
import type { RetailProductCreate, RetailProductUpdate } from '../types';

// ── Query key factory ──────────────────────────────────────────────
export const retailKeys = {
  all: ['retail'] as const,
  products: (params?: unknown) => ['retail', 'products', params] as const,
  product: (id: number) => ['retail', 'products', id] as const,
  categories: ['retail', 'categories'] as const,
  suppliers: ['retail', 'suppliers'] as const,
  stats: ['retail', 'stats'] as const,
  sales: (params?: unknown) => ['retail', 'sales', params] as const,
  salesStats: (params?: unknown) => ['retail', 'sales-stats', params] as const,
};

// ── Products ────────────────────────────────────────────────────────
export function useRetailProducts(params?: PaginationParams & { search?: string; category_id?: number; low_stock_only?: boolean }) {
  return useQuery({
    queryKey: retailKeys.products(params),
    queryFn: () => retailApi.listProducts(params).then(r => r.data),
  });
}

export function useRetailProduct(id: number) {
  return useQuery({
    queryKey: retailKeys.product(id),
    queryFn: () => retailApi.getProduct(id).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateRetailProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RetailProductCreate) => retailApi.createProduct(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retailKeys.products() });
      qc.invalidateQueries({ queryKey: retailKeys.stats });
      toastSuccess('Product created successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdateRetailProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RetailProductUpdate }) =>
      retailApi.updateProduct(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retailKeys.products() });
      qc.invalidateQueries({ queryKey: retailKeys.stats });
      toastSuccess('Product updated successfully');
    },
    onError: toastApiError,
  });
}

export function useDeleteRetailProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => retailApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: retailKeys.products() });
      qc.invalidateQueries({ queryKey: retailKeys.stats });
      toastSuccess('Product deleted');
    },
    onError: toastApiError,
  });
}

// ── Categories & Suppliers ──────────────────────────────────────────
export function useRetailCategories() {
  return useQuery({
    queryKey: retailKeys.categories,
    queryFn: () => retailApi.listCategories().then(r => r.data),
  });
}

export function useRetailSuppliers() {
  return useQuery({
    queryKey: retailKeys.suppliers,
    queryFn: () => retailApi.listSuppliers().then(r => r.data),
  });
}

// ── Stats ────────────────────────────────────────────────────────────
export function useRetailStats() {
  return useQuery({
    queryKey: retailKeys.stats,
    queryFn: () => retailApi.getStats().then(r => r.data),
  });
}

// ── Sales ────────────────────────────────────────────────────────────
export function useRetailSales(params?: PaginationParams & { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: retailKeys.sales(params),
    queryFn: () => retailApi.listSales(params).then(r => r.data),
  });
}

export function useRetailSalesStats(params?: { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: retailKeys.salesStats(params),
    queryFn: () => retailApi.getSalesStats(params).then(r => r.data),
  });
}
