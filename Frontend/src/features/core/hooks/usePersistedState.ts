import { useEffect, useState } from 'react';

// Lightweight persisted state hook. Stores JSON in localStorage under the provided key.
export function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {/* ignore quota */}
  }, [key, state]);
  return [state, setState];
}
