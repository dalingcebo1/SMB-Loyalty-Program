// src/setupTests.ts
// Mock ToastContainer to avoid timer-related hangs in tests
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// stub react-toastify to prevent timers and DOM insertion
vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// mock react-hook-form to avoid ref and hook issues in tests
vi.mock('react-hook-form', () => {
  return {
    useForm: () => ({
      register: (): Record<string, unknown> => ({}),
      handleSubmit: (fn: (...args: any[]) => any): ((...args: any[]) => any) => {
        return (...args: any[]) => fn(...args);
      },
      formState: { errors: {}, isSubmitting: false },
    }),
  };
});
