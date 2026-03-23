import api from '../api';
import type {
  FlowershopCategory,
  FlowershopOccasion,
  FlowershopProduct,
  FlowershopProductCreate,
  FlowershopProductUpdate,
} from '../../features/flowershop/types';

export const flowershopApi = {
  // Categories
  listCategories: () =>
    api.get<FlowershopCategory[]>('/api/flowershop/categories'),

  // Occasions
  listOccasions: () =>
    api.get<FlowershopOccasion[]>('/api/flowershop/occasions'),

  // Products
  listProducts: (params?: { category_id?: number; occasion_id?: number; featured?: boolean; search?: string }) =>
    api.get<FlowershopProduct[]>('/api/flowershop/products', { params }),

  getProduct: (id: number) =>
    api.get<FlowershopProduct>(`/api/flowershop/products/${id}`),

  createProduct: (data: FlowershopProductCreate) =>
    api.post<FlowershopProduct>('/api/flowershop/products', data),

  updateProduct: (id: number, data: FlowershopProductUpdate) =>
    api.put<FlowershopProduct>(`/api/flowershop/products/${id}`, data),

  deleteProduct: (id: number) =>
    api.delete(`/api/flowershop/products/${id}`),

  // Orders
  createOrder: (data: { items: { product_id: number; quantity: number }[]; delivery_date?: string; delivery_slot?: string; recipient_name?: string; recipient_phone?: string; delivery_address?: string; card_message?: string; special_instructions?: string }) =>
    api.post('/api/flowershop/orders', data),

  // Delivery slots
  getDeliverySlots: (params: { date: string }) =>
    api.get('/api/flowershop/delivery-slots', { params }),

  // Payments
  createPayment: (orderId: number, data: { payment_token: string; amount_cents: number }) =>
    api.post(`/api/flowershop/orders/${orderId}/pay`, data),
};
