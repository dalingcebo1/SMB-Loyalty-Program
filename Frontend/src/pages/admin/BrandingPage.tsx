import React, { useEffect, useState, ChangeEvent } from 'react';
import { FaPalette, FaImage, FaIdCard, FaUpload, FaCheck, FaTimes, FaEye } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../api/api';
import { useCapabilities } from '../../features/admin/hooks/useCapabilities';
import LoadingSpinner from '../../components/LoadingSpinner';

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
        // fetch assets list to show existing variants if any
        try {
          const assetsResp = await api.get(`/tenants/${tenantId}/branding/assets`);
          type AssetEntry = { name: string; size: number; url: string };
          const entries: AssetEntry[] = assetsResp.data.assets || [];
            const variants: Record<string,string> = {};
            entries.forEach((a) => {
              const m = a.name.match(/-(64|128|256|512)\./);
              if (m) variants[m[1]] = a.url;
            });
            if (Object.keys(variants).length) setLastVariants(variants);
  } catch { /* ignore asset listing errors */ }
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <FaPalette className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Branding</h1>
              <p className="text-sm text-gray-500">Customize your brand identity and visual elements</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => window.location.reload()} 
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <HiOutlineRefresh className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-500">Loading branding settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Identity Section */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <FaIdCard className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Brand Identity</h2>
                    <p className="text-sm text-gray-500">Basic information about your business</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Public Name
                    </label>
                    <input 
                      value={form.public_name} 
                      onChange={e => update('public_name', e.target.value)} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors" 
                      placeholder="Your Business Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Short Name
                    </label>
                    <input 
                      value={form.short_name} 
                      onChange={e => update('short_name', e.target.value)} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors" 
                      placeholder="Short Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Support Email
                    </label>
                    <input 
                      type="email" 
                      value={form.support_email} 
                      onChange={e => update('support_email', e.target.value)} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors" 
                      placeholder="support@yourcompany.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Support Phone
                    </label>
                    <input 
                      value={form.support_phone} 
                      onChange={e => update('support_phone', e.target.value)} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors" 
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Colors Section */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-pink-50 rounded-lg">
                    <FaPalette className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Brand Colors</h2>
                    <p className="text-sm text-gray-500">Define your color palette and theme</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['primary_color', 'secondary_color', 'accent_color'] as const).map(key => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <input 
                            type="color" 
                            value={form[key] || '#000000'} 
                            onChange={e => update(key, e.target.value)} 
                            className="h-12 w-16 rounded-lg border border-gray-300 cursor-pointer"
                          />
                          <input 
                            value={form[key]} 
                            onChange={e => update(key, e.target.value)} 
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors font-mono text-sm" 
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Color Preview */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <FaEye className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Color Preview</span>
                  </div>
                  <div key={previewKey} className="flex flex-wrap gap-4">
                    {[
                      { label: 'Primary', value: form.primary_color, bg: 'bg-blue-50' },
                      { label: 'Secondary', value: form.secondary_color, bg: 'bg-gray-50' },
                      { label: 'Accent', value: form.accent_color, bg: 'bg-purple-50' }
                    ].map(color => (
                      <div key={color.label} className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${color.bg} border`}>
                        <div 
                          className="w-6 h-6 rounded-full border-2 border-white shadow-sm" 
                          style={{ backgroundColor: color.value || '#ffffff' }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{color.label}</div>
                          <div className="text-xs text-gray-500 font-mono">{color.value || 'Not set'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Logos & Icons Section */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <FaImage className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Logos & Icons</h2>
                    <p className="text-sm text-gray-500">Upload or provide URLs for your brand assets</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* URL Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {[
                    { key: 'logo_light_url', label: 'Light Logo URL', placeholder: 'https://your-domain.com/logo-light.png' },
                    { key: 'logo_dark_url', label: 'Dark Logo URL', placeholder: 'https://your-domain.com/logo-dark.png' },
                    { key: 'favicon_url', label: 'Favicon URL', placeholder: 'https://your-domain.com/favicon.ico' },
                    { key: 'app_icon_url', label: 'App Icon URL', placeholder: 'https://your-domain.com/app-icon.png' }
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                      </label>
                      <input 
                        value={form[field.key as keyof BrandingForm]} 
                        onChange={e => update(field.key as keyof BrandingForm, e.target.value)} 
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors" 
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>

                {/* File Uploads */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <FaUpload className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Upload Files</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: 'logo_light', label: 'Light Logo', accept: 'image/*' },
                      { key: 'logo_dark', label: 'Dark Logo', accept: 'image/*' },
                      { key: 'favicon', label: 'Favicon', accept: 'image/*,.ico' },
                      { key: 'app_icon', label: 'App Icon', accept: 'image/*' }
                    ].map(upload => (
                      <div key={upload.key} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          {upload.label}
                        </label>
                        <div className="flex items-center space-x-3">
                          <label className="flex-1 cursor-pointer">
                            <input 
                              type="file" 
                              accept={upload.accept}
                              disabled={!canEdit || uploading === upload.key}
                              onChange={e => handleFile(upload.key as 'logo_light'|'logo_dark'|'favicon'|'app_icon', e)}
                              className="sr-only"
                            />
                            <div className="flex items-center justify-center px-4 py-3 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                              {uploading === upload.key ? (
                                <div className="flex items-center space-x-2">
                                  <LoadingSpinner size="sm" />
                                  <span className="text-sm text-gray-500">Uploading...</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <FaUpload className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-500">Choose file</span>
                                </div>
                              )}
                            </div>
                          </label>
                          {form[`${upload.key}_url` as keyof BrandingForm] && (
                            <div className="flex items-center space-x-1">
                              <FaCheck className="w-4 h-4 text-green-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Asset Status */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { key: 'logo_light_url', label: 'Light Logo' },
                      { key: 'logo_dark_url', label: 'Dark Logo' },
                      { key: 'favicon_url', label: 'Favicon' },
                      { key: 'app_icon_url', label: 'App Icon' }
                    ].map(asset => (
                      <div key={asset.key} className="flex items-center space-x-2">
                        {form[asset.key as keyof BrandingForm] ? (
                          <FaCheck className="w-4 h-4 text-green-500" />
                        ) : (
                          <FaTimes className="w-4 h-4 text-gray-300" />
                        )}
                        <span className="text-sm text-gray-600">{asset.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload Error */}
                {uploadError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{uploadError}</p>
                  </div>
                )}

                {/* Generated Variants */}
                {lastVariants && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center space-x-3 mb-4">
                      <FaEye className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Generated Variants</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(lastVariants).map(([size, url]) => (
                        <div key={size} className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg">
                          <img src={url} alt={`${size}px`} className="w-12 h-12 object-contain rounded" />
                          <span className="text-xs text-gray-500 font-medium">{size}px</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={!canEdit || saving} 
                className="px-6 py-3 bg-purple-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                {saving && <LoadingSpinner size="sm" color="white" />}
                {saving ? (
                  <span className="ml-2">Saving Changes...</span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BrandingPage;
