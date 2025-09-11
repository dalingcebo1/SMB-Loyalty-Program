if (typeof window !== 'undefined') {
  const API_BASE: string | undefined = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_API_BASE_URL;
  if (API_BASE) {
    const normalize = (base: string) => (base.endsWith('/') ? base.slice(0, -1) : base);
    const base = normalize(API_BASE);
    const origFetch: typeof window.fetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
        if (url.startsWith('/api')) {
          const newUrl = base + url;
          if (typeof input === 'string' || input instanceof URL) {
            return origFetch(newUrl, init);
          }
          const req = new Request(newUrl, input as RequestInit);
          return origFetch(req, init);
        }
      } catch {}
      return origFetch(input as RequestInfo, init as RequestInit | undefined);
    };
  }
}
