import { useEffect, useState } from 'react';

export interface TenantTheme {
  tenant_id: string;
  public_name?: string;
  short_name?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_light_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
}

export function useTenantTheme() {
  const [theme, setTheme] = useState<TenantTheme | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/public/tenant-theme')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!cancelled && data) {
            setTheme(data);
            const root = document.documentElement;
            if (data.primary_color) root.style.setProperty('--color-primary', data.primary_color);
            if (data.accent_color) root.style.setProperty('--color-accent', data.accent_color || data.primary_color);
            if (data.favicon_url) {
              const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
              if (existing) existing.href = data.favicon_url; else {
                const link = document.createElement('link');
                link.rel = 'icon'; link.href = data.favicon_url; document.head.appendChild(link);
              }
            }
          }
        })
        .catch(()=>{});
    };
    load();
    const handler = () => load();
    window.addEventListener('tenant-theme:refresh', handler);
    return () => { cancelled = true; };
  }, []);
  return theme;
}
