import { describe, it, expect, vi } from 'vitest';

// Mock analytics track
vi.mock('../analytics', () => ({
  track: vi.fn(),
}));

// Mock react-toastify toast methods
vi.mock('react-toastify', () => {
  const success = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  const warning = vi.fn();
  return {
    toast: { success, error, info, warning },
    ToastContainer: () => null,
  };
});

import { notifySuccess, notifyError, notifyInfo, notifyWarning } from '../notifications';
import { track } from '../analytics';
import { toast } from 'react-toastify';

describe('notifications dedupe', () => {
  it('suppresses duplicate success messages within interval', () => {
    const startCalls = (toast.success as any).mock.calls.length;
    notifySuccess('Duplicate Test');
    notifySuccess('Duplicate Test');
    const endCalls = (toast.success as any).mock.calls.length;
    expect(endCalls - startCalls).toBe(1);
  });

  it('allows skipping dedupe when skipDedupe set', () => {
    const startCalls = (toast.info as any).mock.calls.length;
    notifyInfo('Stream Event', { skipDedupe: true });
    notifyInfo('Stream Event', { skipDedupe: true });
    const endCalls = (toast.info as any).mock.calls.length;
    expect(endCalls - startCalls).toBeGreaterThanOrEqual(2);
  });
});

describe('notifications module', () => {
  it('notifySuccess calls toast.success and tracks event', () => {
    notifySuccess('Success message');
  expect(toast.success).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('toast', expect.objectContaining({ level: 'success', message: 'Success message' }));
  });

  it('notifyError calls toast.error and tracks event', () => {
    notifyError('Error message');
  expect(toast.error).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('toast', expect.objectContaining({ level: 'error', message: 'Error message' }));
  });

  it('notifyInfo calls toast.info and tracks event', () => {
    notifyInfo('Info message');
  expect(toast.info).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('toast', expect.objectContaining({ level: 'info', message: 'Info message' }));
  });

  it('notifyWarning calls toast.warning and tracks event', () => {
    notifyWarning('Warn message');
  expect(toast.warning).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('toast', expect.objectContaining({ level: 'warning', message: 'Warn message' }));
  });
});
