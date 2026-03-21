import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInstallPrompt } from '../useInstallPrompt';

// Minimal BeforeInstallPromptEvent stub
function createPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  (event as any).prompt = vi.fn().mockResolvedValue(undefined);
  (event as any).userChoice = Promise.resolve({ outcome });
  return event;
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Default: not standalone
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not show prompt on first visit', () => {
    const { result } = renderHook(() => useInstallPrompt());
    window.dispatchEvent(createPromptEvent());
    // Visit count is only 1 at this point
    expect(result.current.canPrompt).toBe(false);
  });

  it('shows prompt after 2+ visits when beforeinstallprompt fires', () => {
    // Simulate a previous visit
    localStorage.setItem('pwa-visit-count', '1');
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(createPromptEvent());
    });
    expect(result.current.canPrompt).toBe(true);
  });

  it('does not show prompt if user previously dismissed', () => {
    localStorage.setItem('pwa-visit-count', '5');
    localStorage.setItem('pwa-install-dismissed', '1');
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(createPromptEvent());
    });
    expect(result.current.canPrompt).toBe(false);
  });

  it('dismiss() hides the prompt and persists choice', () => {
    localStorage.setItem('pwa-visit-count', '5');
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(createPromptEvent());
    });
    expect(result.current.canPrompt).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.canPrompt).toBe(false);
    expect(localStorage.getItem('pwa-install-dismissed')).toBe('1');
  });

  it('promptInstall() triggers the native prompt', async () => {
    localStorage.setItem('pwa-visit-count', '5');
    const { result } = renderHook(() => useInstallPrompt());
    const event = createPromptEvent('accepted');
    act(() => {
      window.dispatchEvent(event);
    });
    await act(async () => {
      await result.current.promptInstall();
    });
    expect((event as any).prompt).toHaveBeenCalled();
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canPrompt).toBe(false);
  });

  it('detects standalone mode as already installed', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canPrompt).toBe(false);
  });
});
