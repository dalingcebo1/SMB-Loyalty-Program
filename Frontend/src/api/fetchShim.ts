const ABSOLUTE_URL = /^[a-z]+:\/\//i;

function computeBaseURL(): string | null {
  const raw = import.meta.env?.VITE_API_BASE_URL ?? '';
  const trimmed = raw.replace(/\/+$/g, '');
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
