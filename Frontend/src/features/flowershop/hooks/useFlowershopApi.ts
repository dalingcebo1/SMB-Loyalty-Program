import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flowershopApi } from '../../../api/verticals/flowershop';
import { toastApiError, toastSuccess } from '../../../utils/apiErrors';
import type { FlowershopProductCreate, FlowershopProductUpdate } from '../types';

// ── Query key factory ──────────────────────────────────────────────
export const flowershopKeys = {
  all: ['flowershop'] as const,
  categories: ['flowershop', 'categories'] as const,
  occasions: ['flowershop', 'occasions'] as const,
  products: (params?: Record<string, unknown>) => ['flowershop', 'products', params] as const,
  product: (id: number) => ['flowershop', 'products', id] as const,
  deliverySlots: (date: string) => ['flowershop', 'delivery-slots', date] as const,
};

// ── Categories ──────────────────────────────────────────────────────
export function useFlowershopCategories() {
  return useQuery({
    queryKey: flowershopKeys.categories,
    queryFn: () => flowershopApi.listCategories().then(r => r.data),
  });
}

// ── Occasions ───────────────────────────────────────────────────────
export function useFlowershopOccasions() {
  return useQuery({
    queryKey: flowershopKeys.occasions,
    queryFn: () => flowershopApi.listOccasions().then(r => r.data),
  });
}

// ── Products ────────────────────────────────────────────────────────
export function useFlowershopProducts(params?: { category_id?: number; occasion_id?: number; featured?: boolean; search?: string }) {
  return useQuery({
    queryKey: flowershopKeys.products(params as Record<string, unknown>),
    queryFn: () => flowershopApi.listProducts(params).then(r => r.data),
  });
}

export function useFlowershopProduct(id: number) {
  return useQuery({
    queryKey: flowershopKeys.product(id),
    queryFn: () => flowershopApi.getProduct(id).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateFlowershopProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FlowershopProductCreate) => flowershopApi.createProduct(data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flowershop', 'products'] });
      toastSuccess('Product created successfully');
    },
    onError: toastApiError,
  });
}

export function useUpdateFlowershopProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FlowershopProductUpdate }) =>
      flowershopApi.updateProduct(id, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flowershop', 'products'] });
      toastSuccess('Product updated successfully');
    },
    onError: toastApiError,
  });
}

export function useDeleteFlowershopProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => flowershopApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flowershop', 'products'] });
      toastSuccess('Product deleted');
    },
    onError: toastApiError,
  });
}

// ── Orders ──────────────────────────────────────────────────────────
export function useCreateFlowershopOrder() {
  return useMutation({
    mutationFn: (data: Parameters<typeof flowershopApi.createOrder>[0]) =>
      flowershopApi.createOrder(data).then(r => r.data),
    onError: toastApiError,
  });
}

// ── Delivery Slots ──────────────────────────────────────────────────
export function useFlowershopDeliverySlots(date: string) {
  return useQuery({
    queryKey: flowershopKeys.deliverySlots(date),
    queryFn: () => flowershopApi.getDeliverySlots({ date }).then(r => r.data),
    enabled: !!date,
  });
}

// ── Payments ────────────────────────────────────────────────────────
export function useFlowershopPayment() {
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: { payment_token: string; amount_cents: number } }) =>
      flowershopApi.createPayment(orderId, data).then(r => r.data),
    onError: toastApiError,
  });
}
