if (typeof window !== 'undefined') {
  const envBase = import.meta.env?.VITE_API_BASE_URL;
  if (envBase) {
    const normalize = (base: string) => (base.endsWith('/') ? base.slice(0, -1) : base);
    const base = normalize(envBase);
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
        if (targetUrl && targetUrl.startsWith('/api')) {
          const rewritten = `${base}${targetUrl}`;
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
