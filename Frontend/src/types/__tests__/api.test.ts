import { describe, it, expect } from 'vitest';
import type { PaginatedResponse, PaginationParams, ApiError } from '../../types/api';

describe('API Types', () => {
  describe('PaginatedResponse', () => {
    it('should accept a valid paginated response', () => {
      const response: PaginatedResponse<{ id: number; name: string }> = {
        items: [{ id: 1, name: 'Test' }],
        total: 1,
        page: 1,
        per_page: 20,
        has_next: false,
      };
      expect(response.items).toHaveLength(1);
      expect(response.total).toBe(1);
      expect(response.has_next).toBe(false);
    });

    it('should work with empty items', () => {
      const response: PaginatedResponse<string> = {
        items: [],
        total: 0,
        page: 1,
        per_page: 20,
        has_next: false,
      };
      expect(response.items).toHaveLength(0);
    });
  });

  describe('PaginationParams', () => {
    it('should accept partial params', () => {
      const params: PaginationParams = { page: 2 };
      expect(params.page).toBe(2);
      expect(params.per_page).toBeUndefined();
    });

    it('should accept full params', () => {
      const params: PaginationParams = {
        page: 1,
        per_page: 50,
        sort_by: 'name',
        sort_order: 'desc',
      };
      expect(params.sort_order).toBe('desc');
    });
  });

  describe('ApiError', () => {
    it('should represent a standard error', () => {
      const err: ApiError = {
        detail: 'Not found',
        error_code: 'NOT_FOUND',
      };
      expect(err.field_errors).toBeUndefined();
    });

    it('should represent a validation error with field errors', () => {
      const err: ApiError = {
        detail: 'Validation failed',
        error_code: 'VALIDATION_ERROR',
        field_errors: {
          name: ['Name is required'],
          price: ['Must be positive'],
        },
      };
      expect(err.field_errors).toBeDefined();
      expect(err.field_errors!['name']).toContain('Name is required');
    });
  });
});
