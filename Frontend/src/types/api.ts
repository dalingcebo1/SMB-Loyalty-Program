/**
 * Shared API types that mirror the standardized backend responses.
 * Used by all vertical API clients and React Query hooks.
 */

/** Matches backend PaginatedResponse exactly */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

/** Query parameters for paginated list endpoints */
export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/** Structured error returned by the backend */
export interface ApiError {
  detail: string;
  error_code: string;
  field_errors?: Record<string, string[]>;
}
