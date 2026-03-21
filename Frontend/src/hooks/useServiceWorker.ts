// src/hooks/useServiceWorker.ts
import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
}

/**
 * Tracks the state of the VitePWA-managed service worker and network
 * connectivity.  Registration is handled by VitePWA's `registerType:
 * 'autoUpdate'` in `vite.config.ts` – this hook only observes.
 */
export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    isRegistered: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    updateAvailable: false,
  });

  useEffect(() => {
    if (!state.isSupported) return;

    // Check if a service worker is already controlling the page
    if (navigator.serviceWorker.controller) {
      setState((prev) => ({ ...prev, isRegistered: true }));
    }

    const onControllerChange = () => {
      setState((prev) => ({ ...prev, isRegistered: true }));
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Listen for the VitePWA-registered SW becoming active
    navigator.serviceWorker.ready.then((registration) => {
      setState((prev) => ({ ...prev, isRegistered: true }));

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setState((prev) => ({ ...prev, updateAvailable: true }));
          }
        });
      });
    });

    // Online / offline tracking
    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, [state.isSupported]);

  /** Tell the waiting SW to skip waiting and take control. */
  const applyUpdate = () => {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        // Wait for the new worker to take control before reloading
        const onControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  /** Ask the active SW to clear its caches. */
  const clearCache = () => {
    navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_CACHE' });
  };

  return { ...state, applyUpdate, clearCache };
}
