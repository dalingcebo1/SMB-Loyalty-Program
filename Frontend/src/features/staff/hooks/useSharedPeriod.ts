// Shared period hook for synchronizing selected analytics period across pages (e.g., Business Analytics & Wash History)
import { useState, useCallback, useEffect } from 'react';

const KEY = 'staffSelectedPeriod';
const VALID = new Set(['today','week','month','quarter','custom']);

export function useSharedPeriod(defaultValue: string = 'week') {
  const initial = (() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = window.localStorage.getItem(KEY);
    return stored && VALID.has(stored) ? stored : defaultValue;
  })();
  const [period, setPeriod] = useState<string>(initial);

  const update = useCallback((p: string) => {
    const val = VALID.has(p) ? p : defaultValue;
    setPeriod(val);
    try { window.localStorage.setItem(KEY, val); } catch { /* ignore */ }
  }, [defaultValue]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue && VALID.has(e.newValue)) {
        setPeriod(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return [period, update] as const;
}

export function parsePeriodFromQuery(q: URLSearchParams): string | undefined {
  const p = q.get('period');
  return p && VALID.has(p) ? p : undefined;
}
