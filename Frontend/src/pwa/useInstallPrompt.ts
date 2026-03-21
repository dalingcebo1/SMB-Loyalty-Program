import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimum visits before showing the install prompt. */
const MIN_VISITS = 2;
const VISIT_COUNT_KEY = 'pwa-visit-count';
const DISMISSED_KEY = 'pwa-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallPromptState {
  /** Whether the install prompt can be shown (criteria met). */
  canPrompt: boolean;
  /** Whether the app is already installed (standalone). */
  isInstalled: boolean;
  /** Trigger the native install prompt. */
  promptInstall: () => Promise<void>;
  /** Dismiss the custom prompt and remember the choice. */
  dismiss: () => void;
}

/**
 * Captures the browser `beforeinstallprompt` event and provides a
 * controlled API for showing a custom "Add to Home Screen" prompt.
 *
 * The prompt is only surfaced after the user has visited the app at
 * least {@link MIN_VISITS} times and has not previously dismissed it.
 */
export function useInstallPrompt(): InstallPromptState {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect if already installed as standalone / TWA
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(display-mode: standalone)');
      if (mq.matches || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone)) {
        setIsInstalled(true);
        return;
      }
    }

    // Increment visit count once per session to avoid inflation from HMR
    const sessionKey = 'pwa-visit-counted';
    let count = Number(localStorage.getItem(VISIT_COUNT_KEY) || '0');
    if (!sessionStorage.getItem(sessionKey)) {
      count += 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(count));
      sessionStorage.setItem(sessionKey, '1');
    }

    const wasDismissed = localStorage.getItem(DISMISSED_KEY) === '1';

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (count >= MIN_VISITS && !wasDismissed) {
        setCanPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    deferredPrompt.current = null;
    setCanPrompt(false);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setCanPrompt(false);
    deferredPrompt.current = null;
  }, []);

  return { canPrompt, isInstalled, promptInstall, dismiss };
}
