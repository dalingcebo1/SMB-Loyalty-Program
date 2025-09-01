import React, { useEffect, useState, ChangeEvent } from 'react';
import api from '../../api/api';
import { useCapabilities } from '../../features/admin/hooks/useCapabilities';

interface BrandingForm {
  public_name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_light_url: string;
  logo_dark_url: string;
  favicon_url: string;
  app_icon_url: string;
  support_email: string;
  support_phone: string;
}

const empty: BrandingForm = {
  public_name: '', short_name: '', primary_color: '', secondary_color: '', accent_color: '',
  logo_light_url: '', logo_dark_url: '', favicon_url: '', app_icon_url: '', support_email: '', support_phone: ''
};

const BrandingPage: React.FC = () => {
  const { has } = useCapabilities();
  const canEdit = has('tenant.edit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BrandingForm>(empty);
  const tenantId = 'default'; // TODO: derive from auth/tenant context
  const [previewKey, setPreviewKey] = useState(0); // trigger color preview re-render
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastVariants, setLastVariants] = useState<Record<string,string>|null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/tenants/${tenantId}/branding`);
        if (cancelled) return;
        setForm({ ...empty, ...res.data });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const update = (k: keyof BrandingForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (['primary_color','accent_color','secondary_color'].includes(k)) {
      setPreviewKey(x => x+1);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      await api.put(`/tenants/${tenantId}/branding`, form);
    } finally {
      setSaving(false);
    }
  };

  const colorBox = (label: string, value: string) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 h-3 rounded border" style={{ background: value || '#fff' }} />
      <span className="text-gray-600">{label}</span>
    </div>
  );

  const handleFile = async (field: 'logo_light'|'logo_dark'|'favicon'|'app_icon', e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(field);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/tenants/${tenantId}/branding/assets/${field}`, { method: 'POST', body: formData, headers: { 'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '' }});
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Upload failed');
      }
      const data = await res.json();
      const mapping: Record<string, keyof BrandingForm> = {
        logo_light: 'logo_light_url',
        logo_dark: 'logo_dark_url',
        favicon: 'favicon_url',
        app_icon: 'app_icon_url'
      };
      const k = mapping[field];
  setForm(f => ({ ...f, [k]: data.url }));
  if (data.variants) setLastVariants(data.variants);
  // Trigger global theme refresh so new favicon/colors propagate
  window.dispatchEvent(new Event('tenant-theme:refresh'));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Branding</h1>
        <p className="text-sm text-gray-500">Manage logos, colors and identity tokens.</p>
      </header>
      {loading ? (
        <div className="p-6 bg-white border rounded shadow-sm">Loading…</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <section className="bg-white border rounded p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">Identity</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm space-y-1">
                <span className="font-medium">Public Name</span>
                <input value={form.public_name} onChange={e=>update('public_name', e.target.value)} className="w-full rounded border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="text-sm space-y-1">
                <span className="font-medium">Short Name</span>
                <input value={form.short_name} onChange={e=>update('short_name', e.target.value)} className="w-full rounded border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="text-sm space-y-1 md:col-span-2">
                <span className="font-medium">Support Email</span>
                <input type="email" value={form.support_email} onChange={e=>update('support_email', e.target.value)} className="w-full rounded border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="text-sm space-y-1 md:col-span-2">
                <span className="font-medium">Support Phone</span>
                <input value={form.support_phone} onChange={e=>update('support_phone', e.target.value)} className="w-full rounded border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>
          </section>
          <section className="bg-white border rounded p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">Colors</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {['primary_color','secondary_color','accent_color'].map(key => (
                <label key={key} className="text-sm space-y-1">
                  <span className="font-medium capitalize">{key.replace('_',' ').replace('_',' ')}</span>
                  <div className="flex gap-2">
                    <input type="color" value={form[key as keyof BrandingForm] || '#000000'} onChange={e=>update(key as keyof BrandingForm, e.target.value)} className="h-10 w-14 rounded border" />
                    <input value={form[key as keyof BrandingForm]} onChange={e=>update(key as keyof BrandingForm, e.target.value)} className="flex-1 rounded border px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-mono" />
                  </div>
                </label>
              ))}
            </div>
            <div key={previewKey} className="flex gap-6 pt-2">
              {colorBox('Primary', form.primary_color)}
              {colorBox('Secondary', form.secondary_color)}
              {colorBox('Accent', form.accent_color)}
            </div>
          </section>
          <section className="bg-white border rounded p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">Logos & Icons (URLs)</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {['logo_light_url','logo_dark_url','favicon_url','app_icon_url'].map(key => (
                <label key={key} className="text-sm space-y-1">
                  <span className="font-medium capitalize">{key.replace(/_/g,' ')}</span>
                  <input value={form[key as keyof BrandingForm]} onChange={e=>update(key as keyof BrandingForm, e.target.value)} placeholder="https://..." className="w-full rounded border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <label className="text-xs font-medium text-gray-600">Upload Light Logo
                <input type="file" accept="image/*" disabled={!canEdit || uploading==='logo_light'} onChange={e=>handleFile('logo_light', e)} className="mt-1 block w-full text-xs" />
              </label>
              <label className="text-xs font-medium text-gray-600">Upload Dark Logo
                <input type="file" accept="image/*" disabled={!canEdit || uploading==='logo_dark'} onChange={e=>handleFile('logo_dark', e)} className="mt-1 block w-full text-xs" />
              </label>
              <label className="text-xs font-medium text-gray-600">Upload Favicon
                <input type="file" accept="image/*,.ico" disabled={!canEdit || uploading==='favicon'} onChange={e=>handleFile('favicon', e)} className="mt-1 block w-full text-xs" />
              </label>
              <label className="text-xs font-medium text-gray-600">Upload App Icon
                <input type="file" accept="image/*" disabled={!canEdit || uploading==='app_icon'} onChange={e=>handleFile('app_icon', e)} className="mt-1 block w-full text-xs" />
              </label>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-gray-500">
              {form.logo_light_url && <span>Light Logo ✓</span>}
              {form.logo_dark_url && <span>Dark Logo ✓</span>}
              {form.favicon_url && <span>Favicon ✓</span>}
              {form.app_icon_url && <span>App Icon ✓</span>}
            </div>
            {uploading && <div className="text-xs text-blue-600">Uploading {uploading}…</div>}
            {uploadError && <div className="text-xs text-red-600">{uploadError}</div>}
            {lastVariants && (
              <div className="pt-2 border-t mt-2">
                <div className="text-xs font-medium text-gray-600 mb-1">Generated Variants</div>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(lastVariants).map(([k,url]) => (
                    <div key={k} className="flex flex-col items-center gap-1">
                      <img src={url} alt={k} className="h-12 w-12 object-contain border rounded bg-white" />
                      <span className="text-[10px] text-gray-500">{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
          <div className="flex justify-end">
            <button disabled={!canEdit || saving} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BrandingPage;
