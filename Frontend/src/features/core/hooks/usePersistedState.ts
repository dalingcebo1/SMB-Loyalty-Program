import { useEffect, useState } from 'react';
import { readJsonStorage } from '../../../utils/storage';

// Lightweight persisted state hook. Stores JSON in localStorage under the provided key.
export function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => readJsonStorage<T>(key, initial));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [key, state]);
  return [state, setState];
}
