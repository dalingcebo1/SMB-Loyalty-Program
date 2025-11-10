import { describe, it, expect } from 'vitest';
import { notifySuccess, notifySuccessKey } from '../notifications';
import { rawToast } from '../notifications';

// We'll spy on rawToast.success to count invocations without relying on UI container
describe('notifications dedupe', () => {
  it('suppresses identical messages fired rapidly', () => {
    const spy = vi.spyOn(rawToast, 'success');
    notifySuccess('Payment successful!');
    notifySuccess('Payment successful!');
    notifySuccess('Payment successful!');
    expect(spy.mock.calls.length).toBe(1); // Only first should show within 2.5s window
    spy.mockRestore();
  });

  it('dedupes key-based helpers similarly', () => {
    const spy = vi.spyOn(rawToast, 'success');
    notifySuccessKey('notifications.plan.created');
    notifySuccessKey('notifications.plan.created');
    expect(spy.mock.calls.length).toBe(1);
    spy.mockRestore();
  });
});
