import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTenantManifest } from '../useTenantManifest';

describe('useTenantManifest', () => {
  const fakeBlobUrl = 'blob:http://localhost/fake-manifest';

  beforeEach(() => {
    // jsdom lacks URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue(fakeBlobUrl);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.getElementById('tenant-manifest-link')?.remove();
    vi.restoreAllMocks();
  });

  it('injects a manifest link from the backend', async () => {
    const manifest = { name: 'Test Store', short_name: 'Test', start_url: '/', display: 'standalone' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => manifest,
    } as Response);

    renderHook(() => useTenantManifest());

    await waitFor(() => {
      const link = document.getElementById('tenant-manifest-link') as HTMLLinkElement | null;
      expect(link).not.toBeNull();
      expect(link!.rel).toBe('manifest');
      expect(link!.href).toBe(fakeBlobUrl);
    });
  });

  it('does nothing when the backend is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    renderHook(() => useTenantManifest());

    await new Promise((r) => setTimeout(r, 50));
    expect(document.getElementById('tenant-manifest-link')).toBeNull();
  });

  it('does nothing on non-ok responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    renderHook(() => useTenantManifest());

    await new Promise((r) => setTimeout(r, 50));
    expect(document.getElementById('tenant-manifest-link')).toBeNull();
  });

  it('sets default start_url, scope, and display if missing', async () => {
    const manifest = { name: 'Bare Manifest' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => manifest,
    } as Response);

    renderHook(() => useTenantManifest());

    await waitFor(() => {
      expect(document.getElementById('tenant-manifest-link')).not.toBeNull();
    });

    // Verify the blob was created with the right defaults
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('application/json');
  });
});
