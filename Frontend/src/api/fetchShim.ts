const ABSOLUTE_URL = /^[a-z]+:\/\//i;

function isLocalHost(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    const lower = url.toLowerCase();
    return lower.includes('localhost') || lower.includes('127.0.0.1');
  }
}

function computeBaseURL(): string | null {
  const raw =
    import.meta.env?.VITE_API_BASE_URL_DEV ??
    import.meta.env?.VITE_API_BASE_URL ??
    '';
  const trimmed = raw.replace(/\/+$/g, '');
  // Safety: never use localhost/127.0.0.1 when app isn't served from localhost
  const isBrowser = typeof window !== 'undefined';
  const onLocalHost = isBrowser && ['localhost','127.0.0.1'].includes(window.location.hostname);
  if (trimmed && isLocalHost(trimmed) && !onLocalHost) {
    return null; // fall back to relative fetch
  }
  if (!trimmed) return null;
  if (trimmed.endsWith('/api')) return trimmed;
  return `${trimmed}/api`;
}

function normalizeRelativePath(path: string): string {
  const ensured = path.startsWith('/') ? path : `/${path}`;
  if (ensured === '/api') return '/';
  if (ensured.startsWith('/api/')) {
    const trimmed = ensured.slice(4);
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return ensured;
}

if (typeof window !== 'undefined') {
  const baseURL = computeBaseURL();
  if (baseURL) {
    const origFetch: typeof window.fetch = window.fetch.bind(window);

    const resolveUrl = (input: RequestInfo | URL): string | null => {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.toString();
      if (input instanceof Request) return input.url;
      return null;
    };

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const targetUrl = resolveUrl(input);
        if (targetUrl && !ABSOLUTE_URL.test(targetUrl)) {
          const normalizedPath = normalizeRelativePath(targetUrl);
          const rewritten = `${baseURL}${normalizedPath}`;
          if (typeof input === 'string' || input instanceof URL) {
            return origFetch(rewritten, init);
          }
          const clonedRequest = new Request(rewritten, input as Request);
          return origFetch(clonedRequest, init);
        }
      } catch (error) {
        console.debug('[fetchShim] failed to rewrite request', error);
      }
      return origFetch(input, init);
    };
  }
}
