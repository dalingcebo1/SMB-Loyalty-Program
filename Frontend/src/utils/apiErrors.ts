import type { ApiError } from '../types/api';
import { toast } from 'react-toastify';
import type { AxiosError } from 'axios';

/**
 * Maps backend error codes to user-friendly messages.
 * Keys should match `error_code` values returned by the API.
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Dispensary
  DISPENSARY_PURCHASE_LIMIT_EXCEEDED: 'Daily purchase limit exceeded. Please try again tomorrow.',
  DISPENSARY_AGE_VERIFICATION_REQUIRED: 'Age verification required before purchase.',

  // Beauty
  BEAUTY_APPOINTMENT_SLOT_CONFLICT: 'This time slot is no longer available.',
  BEAUTY_SERVICE_NOT_AVAILABLE: 'This service is currently not available.',

  // Padel
  PADEL_COURT_DOUBLE_BOOKED: 'This court is already booked for the selected time.',
  PADEL_COURT_UNAVAILABLE: 'The selected court is not available.',

  // Retail
  RETAIL_INSUFFICIENT_STOCK: 'Insufficient stock for this product.',
  RETAIL_PRODUCT_NOT_FOUND: 'Product not found.',

  // Flowershop
  FLOWERSHOP_DELIVERY_SLOT_UNAVAILABLE: 'This delivery slot is no longer available.',

  // General
  VALIDATION_ERROR: 'Please check the form for errors.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
};

/**
 * Extract a user-friendly error message from a backend ApiError.
 */
export function getErrorMessage(error: ApiError): string {
  return ERROR_MESSAGES[error.error_code] || error.detail;
}

/**
 * Parse an Axios error into our typed ApiError shape (best-effort).
 */
export function parseApiError(error: unknown): ApiError {
  const axiosErr = error as AxiosError<ApiError>;
  if (axiosErr?.response?.data?.detail) {
    return {
      detail: axiosErr.response.data.detail,
      error_code: axiosErr.response.data.error_code ?? 'UNKNOWN',
      field_errors: axiosErr.response.data.field_errors,
    };
  }
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return { detail: message, error_code: 'UNKNOWN' };
}

/**
 * Show an error toast from an API error.
 */
export function toastApiError(error: unknown): void {
  const parsed = parseApiError(error);
  toast.error(getErrorMessage(parsed));
}

/**
 * Show a success toast.
 */
export function toastSuccess(message: string): void {
  toast.success(message);
}
