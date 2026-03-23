import { describe, it, expect, vi } from 'vitest';
import { getErrorMessage, parseApiError, toastApiError, toastSuccess } from '../apiErrors';

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from 'react-toastify';

describe('apiErrors', () => {
  describe('getErrorMessage', () => {
    it('returns the mapped message for a known error code', () => {
      const msg = getErrorMessage({
        detail: 'limit exceeded',
        error_code: 'DISPENSARY_PURCHASE_LIMIT_EXCEEDED',
      });
      expect(msg).toBe('Daily purchase limit exceeded. Please try again tomorrow.');
    });

    it('returns the detail for an unknown error code', () => {
      const msg = getErrorMessage({
        detail: 'Something went wrong',
        error_code: 'SOME_UNKNOWN_CODE',
      });
      expect(msg).toBe('Something went wrong');
    });

    it('maps beauty appointment conflict', () => {
      const msg = getErrorMessage({
        detail: 'conflict',
        error_code: 'BEAUTY_APPOINTMENT_SLOT_CONFLICT',
      });
      expect(msg).toBe('This time slot is no longer available.');
    });

    it('maps padel double booking', () => {
      const msg = getErrorMessage({
        detail: 'double booked',
        error_code: 'PADEL_COURT_DOUBLE_BOOKED',
      });
      expect(msg).toBe('This court is already booked for the selected time.');
    });
  });

  describe('parseApiError', () => {
    it('extracts error details from an Axios-shaped error', () => {
      const err = {
        response: {
          data: {
            detail: 'Not found',
            error_code: 'NOT_FOUND',
            field_errors: { name: ['required'] },
          },
        },
      };
      const parsed = parseApiError(err);
      expect(parsed.detail).toBe('Not found');
      expect(parsed.error_code).toBe('NOT_FOUND');
      expect(parsed.field_errors).toEqual({ name: ['required'] });
    });

    it('falls back to Error.message for generic errors', () => {
      const parsed = parseApiError(new Error('network fail'));
      expect(parsed.detail).toBe('network fail');
      expect(parsed.error_code).toBe('UNKNOWN');
    });

    it('handles non-Error non-Axios objects', () => {
      const parsed = parseApiError('something');
      expect(parsed.detail).toBe('An unexpected error occurred');
      expect(parsed.error_code).toBe('UNKNOWN');
    });
  });

  describe('toastApiError', () => {
    it('shows an error toast with the mapped message', () => {
      toastApiError({
        response: {
          data: {
            detail: 'limit exceeded',
            error_code: 'DISPENSARY_PURCHASE_LIMIT_EXCEEDED',
          },
        },
      });
      expect(toast.error).toHaveBeenCalledWith(
        'Daily purchase limit exceeded. Please try again tomorrow.'
      );
    });
  });

  describe('toastSuccess', () => {
    it('shows a success toast', () => {
      toastSuccess('Product created');
      expect(toast.success).toHaveBeenCalledWith('Product created');
    });
  });
});
