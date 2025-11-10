import { describe, it, expect, vi } from 'vitest';
import { notifyInfo } from '../notifications';
import { rawToast } from '../notifications';

describe('notifications skipDedupe option', () => {
  it('allows repeated messages when skipDedupe=true', () => {
    const spy = vi.spyOn(rawToast, 'info');
    notifyInfo('Processing batch...', { skipDedupe: true });
    notifyInfo('Processing batch...', { skipDedupe: true });
    notifyInfo('Processing batch...', { skipDedupe: true });
    expect(spy.mock.calls.length).toBe(3);
    spy.mockRestore();
  });
});
