import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dispensaryApi } from '../../../api/verticals/dispensary';
import { toastApiError, toastSuccess } from '../../../utils/apiErrors';
import type { PaginationParams } from '../../../types/api';
import type {
  DispensaryCategoryCreate,
  DispensaryCategoryUpdate,
  DispensaryProductCreate,
  DispensaryProductUpdate,
  DispensaryVerification,
} from '../types';

// ── Query key factory ──────────────────────────────────────────────
export const dispensaryKeys = {
  all: ['dispensary'] as const,
  categories: ['dispensary', 'categories'] as const,
  products: (params?: unknown) => ['dispensary', 'products', params] as const,
  product: (id: number) => ['dispensary', 'products', id] as const,
  sales: (params?: unknown) => ['dispensary', 'sales', params] as const,
  verifications: (params?: unknown) => ['dispensary', 'verifications', params] as const,
  purchaseLimits: (customerId: number) => ['dispensary', 'purchase-limits', customerId] as const,
  compliance: (params?: unknown) => ['dispensary', 'compliance', params] as const,
};

// ── Categories ──────────────────────────────────────────────────────
export function useDispensaryCategories() {
  return useQuery({
    queryKey: dispensaryKeys.categories,
    queryFn: () => dispensaryApi.listCategories().then(r => r.data),
  });
}

export function useCreateDispensaryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DispensaryCategoryCreate) => dispensaryApi.createCategory(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dispensaryKeys.categories });
      toastSuccess('Category created successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdateDispensaryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DispensaryCategoryUpdate }) =>
      dispensaryApi.updateCategory(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dispensaryKeys.categories });
      toastSuccess('Category updated successfully');
    },
    onError: toastApiError,
  });
}

export function useDeleteDispensaryCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dispensaryApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dispensaryKeys.categories });
      toastSuccess('Category deleted');
    },
    onError: toastApiError,
  });
}

// ── Products ────────────────────────────────────────────────────────
export function useDispensaryProducts(params?: PaginationParams & { category_id?: number; search?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: dispensaryKeys.products(params),
    queryFn: () => dispensaryApi.listProducts(params).then(r => r.data),
  });
}

export function useDispensaryProduct(id: number) {
  return useQuery({
    queryKey: dispensaryKeys.product(id),
    queryFn: () => dispensaryApi.getProduct(id).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateDispensaryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DispensaryProductCreate) => dispensaryApi.createProduct(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispensary', 'products'] });
      toastSuccess('Product created successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdateDispensaryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DispensaryProductUpdate }) =>
      dispensaryApi.updateProduct(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispensary', 'products'] });
      toastSuccess('Product updated successfully');
    },
    onError: toastApiError,
  });
}

export function useDeleteDispensaryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => dispensaryApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispensary', 'products'] });
      toastSuccess('Product deleted');
    },
    onError: toastApiError,
  });
}

// ── Sales ────────────────────────────────────────────────────────────
export function useDispensarySales(params?: PaginationParams & { date_from?: string; date_to?: string; status?: string }) {
  return useQuery({
    queryKey: dispensaryKeys.sales(params),
    queryFn: () => dispensaryApi.listSales(params).then(r => r.data),
  });
}

// ── Verifications ───────────────────────────────────────────────────
export function useDispensaryVerifications(params?: { status?: string }) {
  return useQuery({
    queryKey: dispensaryKeys.verifications(params),
    queryFn: () => dispensaryApi.listVerifications(params).then(r => r.data),
  });
}

export function useUpdateDispensaryVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DispensaryVerification> }) =>
      dispensaryApi.updateVerification(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispensary', 'verifications'] });
      toastSuccess('Verification updated');
    },
    onError: toastApiError,
  });
}

// ── Purchase Limits ─────────────────────────────────────────────────
export function useDispensaryPurchaseLimits(customerId: number) {
  return useQuery({
    queryKey: dispensaryKeys.purchaseLimits(customerId),
    queryFn: () => dispensaryApi.getPurchaseLimits(customerId).then(r => r.data),
    enabled: !!customerId,
  });
}

// ── Compliance ──────────────────────────────────────────────────────
export function useDispensaryComplianceReport(params?: { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: dispensaryKeys.compliance(params),
    queryFn: () => dispensaryApi.getComplianceReport(params).then(r => r.data),
  });
}
