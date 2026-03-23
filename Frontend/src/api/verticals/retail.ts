import api from '../api';
import type { PaginatedResponse, PaginationParams } from '../../types/api';
import type {
  RetailProduct,
  RetailProductCreate,
  RetailProductUpdate,
  RetailCategory,
  RetailSupplier,
  RetailInventoryStats,
  RetailSale,
  RetailSalesStats,
} from '../../features/retail/types';

export const retailApi = {
  // Products
  listProducts: (params?: PaginationParams & { search?: string; category_id?: number; low_stock_only?: boolean }) =>
    api.get<PaginatedResponse<RetailProduct> | RetailProduct[]>('/api/retail/products', { params }),

  getProduct: (id: number) =>
    api.get<RetailProduct>(`/api/retail/products/${id}`),

  createProduct: (data: RetailProductCreate) =>
    api.post<RetailProduct>('/api/retail/products', data),

  updateProduct: (id: number, data: RetailProductUpdate) =>
    api.put<RetailProduct>(`/api/retail/products/${id}`, data),

  deleteProduct: (id: number) =>
    api.delete(`/api/retail/products/${id}`),

  // Categories
  listCategories: () =>
    api.get<RetailCategory[]>('/api/retail/categories'),

  // Suppliers
  listSuppliers: () =>
    api.get<RetailSupplier[]>('/api/retail/suppliers'),

  // Stats
  getStats: () =>
    api.get<RetailInventoryStats>('/api/retail/stats'),

  // Sales
  listSales: (params?: PaginationParams & { date_from?: string; date_to?: string }) =>
    api.get<PaginatedResponse<RetailSale> | RetailSale[]>('/api/retail/sales', { params }),

  getSalesStats: (params?: { date_from?: string; date_to?: string }) =>
    api.get<RetailSalesStats>('/api/retail/sales/stats', { params }),
};
