export function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    const value = safeParseJson<T | undefined>(raw, fallback);
    if (value === fallback && raw) {
      window.localStorage.removeItem(key);
    }
    return value ?? fallback;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage removal errors
    }
    return fallback;
  }
}
