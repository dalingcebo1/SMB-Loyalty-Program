import api from '../api';
import type { PaginationParams } from '../../types/api';
import type {
  DispensaryCategory,
  DispensaryCategoryCreate,
  DispensaryCategoryUpdate,
  DispensaryProduct,
  DispensaryProductCreate,
  DispensaryProductUpdate,
  DispensaryVerification,
  DispensaryPurchaseLimits,
  DispensarySale,
} from '../../features/dispensary/types';

export const dispensaryApi = {
  // Categories
  listCategories: () =>
    api.get<DispensaryCategory[]>('/api/dispensary/categories'),

  createCategory: (data: DispensaryCategoryCreate) =>
    api.post<DispensaryCategory>('/api/dispensary/categories', data),

  updateCategory: (id: number, data: DispensaryCategoryUpdate) =>
    api.put<DispensaryCategory>(`/api/dispensary/categories/${id}`, data),

  deleteCategory: (id: number) =>
    api.delete(`/api/dispensary/categories/${id}`),

  // Products
  listProducts: (params?: PaginationParams & { category_id?: number; search?: string; active_only?: boolean }) =>
    api.get<DispensaryProduct[]>('/api/dispensary/products', { params }),

  getProduct: (id: number) =>
    api.get<DispensaryProduct>(`/api/dispensary/products/${id}`),

  createProduct: (data: DispensaryProductCreate) =>
    api.post<DispensaryProduct>('/api/dispensary/products', data),

  updateProduct: (id: number, data: DispensaryProductUpdate) =>
    api.put<DispensaryProduct>(`/api/dispensary/products/${id}`, data),

  deleteProduct: (id: number) =>
    api.delete(`/api/dispensary/products/${id}`),

  // Sales
  listSales: (params?: PaginationParams & { date_from?: string; date_to?: string; status?: string }) =>
    api.get<DispensarySale[]>('/api/dispensary/sales', { params }),

  // Verifications
  listVerifications: (params?: { status?: string }) =>
    api.get<DispensaryVerification[]>('/api/dispensary/verifications', { params }),

  updateVerification: (id: number, data: Partial<DispensaryVerification>) =>
    api.put<DispensaryVerification>(`/api/dispensary/verifications/${id}`, data),

  // Purchase limits
  getPurchaseLimits: (customerId: number) =>
    api.get<DispensaryPurchaseLimits>(`/api/dispensary/customers/${customerId}/purchase-limits`),

  // Compliance
  getComplianceReport: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/api/dispensary/compliance/report', { params }),
};
