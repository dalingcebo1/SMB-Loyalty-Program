import { useEffect } from 'react';

/** Selector for the manifest <link> tag injected into <head>. */
const MANIFEST_LINK_ID = 'tenant-manifest-link';

/**
 * Fetches the tenant-specific web manifest from the backend and injects
 * (or updates) a `<link rel="manifest">` in the document head.
 *
 * Falls back to the static `/manifest.json` produced by VitePWA if
 * the backend is unreachable.
 */
export function useTenantManifest(): void {
  useEffect(() => {
    let revoke: (() => void) | undefined;

    const load = async () => {
      try {
        const res = await fetch('/api/public/tenant-manifest');
        if (!res.ok) return;
        const manifest = await res.json();

        // Ensure sensible defaults
        if (!manifest.start_url) manifest.start_url = '/';
        if (!manifest.scope) manifest.scope = '/';
        if (!manifest.display) manifest.display = 'standalone';

        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        let link = document.getElementById(MANIFEST_LINK_ID) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.id = MANIFEST_LINK_ID;
          link.rel = 'manifest';
          document.head.appendChild(link);
        }
        link.href = url;

        revoke = () => URL.revokeObjectURL(url);
      } catch {
        // Backend unreachable – the static manifest.json from VitePWA is
        // already linked in index.html, so nothing extra is needed.
      }
    };

    load();

    return () => {
      revoke?.();
    };
  }, []);
}
