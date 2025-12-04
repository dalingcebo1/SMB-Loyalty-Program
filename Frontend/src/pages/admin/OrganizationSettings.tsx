import React, { useState, useEffect, ChangeEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import api from '../../api/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tenantSchema, TenantForm } from '../../schemas';
import { AdminPageContainer } from '../../features/admin/components/AdminGrid';
import { AdminCard } from '../../features/admin/components/AdminCard';
import { HiSave, HiTrash, HiMail } from 'react-icons/hi';
import { FaPalette, FaImage, FaIdCard, FaUpload, FaCheck, FaTimes, FaEye } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { useCapabilities } from '../../features/admin/hooks/useCapabilities';

// API tenant shape
interface ApiTenant {
  id: string;
  name: string;
  loyalty_type: string;
  vertical_type: string;
  primary_domain?: string;
  subdomain?: string;
  logo_url?: string;
  theme_color?: string;
  admin_ids: number[];
  config: Record<string, any>;
}

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

const emptyBranding: BrandingForm = {
  public_name: '', short_name: '', primary_color: '', secondary_color: '', accent_color: '',
  logo_light_url: '', logo_dark_url: '', favicon_url: '', app_icon_url: '', support_email: '', support_phone: ''
};

const ProfileSettings: React.FC<{ user: any }> = ({ user }) => {
  const [tenantData, setTenantData] = useState<ApiTenant>({ 
    id: '', name: '', loyalty_type: '', vertical_type: 'carwash', admin_ids: [], config: {} 
  });
  const [error, setError] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // React Hook Form setup
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TenantForm>({
    resolver: zodResolver(tenantSchema),
  });

  useEffect(() => {
    if (user?.tenant_id) {
      setIsLoading(true);
      api.get<ApiTenant>(`/tenants/${user.tenant_id}`)
        .then(res => {
          setTenantData(res.data);
          reset({ 
            name: res.data.name, 
            loyalty_type: res.data.loyalty_type,
            vertical_type: res.data.vertical_type,
            primary_domain: res.data.primary_domain,
            logo_url: res.data.logo_url,
            theme_color: res.data.theme_color,
            config: JSON.stringify(res.data.config, null, 2)
          });
        })
        .catch(err => setError(err.response?.data?.detail || 'Error loading organization details'))
        .finally(() => setIsLoading(false));
    }
  }, [user?.tenant_id, reset]);

  const onSubmit = handleSubmit(async data => {
    if (!user?.tenant_id) return;
    try {
      const payload = {
        ...data,
        config: data.config ? JSON.parse(data.config) : {}
      };

      await api.patch<ApiTenant>(`/tenants/${user.tenant_id}`, payload);
      toast.success('Organization settings updated successfully');
      // Trigger global theme refresh in case name/theme_color changed
      window.dispatchEvent(new Event('tenant-theme:refresh'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const msg = error.response?.data?.detail || 'Save failed';
      setError(msg);
      toast.error(msg);
    }
  });

  const handleRemoveAdmin = (id: number) => {
    if (!user?.tenant_id) return;
    // Prevent removing yourself
    if (id === user.id) {
      toast.error("You cannot remove yourself.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to remove this admin?")) return;

    api.delete<ApiTenant>(`/tenants/${user.tenant_id}/admins/${id}`)
      .then(res => {
        setTenantData(res.data);
        toast.success('Admin removed successfully');
      })
      .catch(err => toast.error(err.response?.data?.detail || 'Remove failed'));
  };

  const handleInvite = async () => {
    if (!inviteEmail || !user?.tenant_id) return;
    setIsInviting(true);
    try {
      const res = await api.post(`tenants/${user.tenant_id}/invite`, { email: inviteEmail });
      toast.success(`Invite sent! Token: ${res.data.token}`);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invite failed');
    } finally {
      setIsInviting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <AdminCard title="Business Profile">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
                <input
                  {...register('name')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vertical Type</label>
                <select
                  {...register('vertical_type')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="carwash">Car Wash</option>
                  <option value="dispensary">Dispensary</option>
                  <option value="padel">Padel</option>
                  <option value="flowershop">Flower Shop</option>
                  <option value="beauty">Beauty</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Loyalty Type</label>
                <select
                  {...register('loyalty_type')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="points">Points Based</option>
                  <option value="visits">Visit Based</option>
                  <option value="stamps">Stamp Card</option>
                </select>
                {errors.loyalty_type && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.loyalty_type.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Domain</label>
                <input
                  {...register('primary_domain')}
                  placeholder="e.g., loyalty.example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    {...register('theme_color')}
                    className="h-10 w-20 p-1 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    {...register('theme_color')}
                    placeholder="#000000"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
                <input
                  {...register('logo_url')}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                {errors.logo_url && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.logo_url.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Configuration (JSON)</label>
              <textarea
                {...register('config')}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
                placeholder="{}"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Advanced configuration in JSON format</p>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center w-full sm:w-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <HiSave className="w-4 h-4 mr-2" />}
                Save Changes
              </button>
            </div>
          </form>
        </AdminCard>
      </div>

      <div className="space-y-6">
        <AdminCard title="Administrators">
          <div className="space-y-4">
            <div className="space-y-2">
              {tenantData.admin_ids.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No admins assigned</p>
              ) : (
                tenantData.admin_ids.map((id: number) => (
                  <div key={id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      User ID: {id} {id === user?.id && '(You)'}
                    </span>
                    {id !== user?.id && (
                      <button
                        onClick={() => handleRemoveAdmin(id)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:bg-red-900/20 rounded"
                        title="Remove admin"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Invite Admin">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Send an email invitation to a new administrator.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button 
                onClick={handleInvite}
                disabled={!inviteEmail || isInviting}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInviting ? <LoadingSpinner size="sm" color="white" /> : <HiMail className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
};

const BrandingSettings: React.FC<{ user: any }> = ({ user }) => {
  const { has } = useCapabilities();
  const canEdit = has('tenant.edit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BrandingForm>(emptyBranding);
  const tenantId = user?.tenant_id;
  const [previewKey, setPreviewKey] = useState(0);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastVariants, setLastVariants] = useState<Record<string,string>|null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/tenants/${tenantId}/branding`);
        if (cancelled) return;
        const brandingPayload = res.data && typeof res.data === 'object' ? res.data : {};
        setForm({ ...emptyBranding, ...brandingPayload });
        try {
          const assetsResp = await api.get(`/tenants/${tenantId}/branding/assets`);
          type AssetEntry = { name: string; size: number; url: string };
          const entries: AssetEntry[] = Array.isArray(assetsResp.data?.assets) ? assetsResp.data.assets : [];
          const variants: Record<string,string> = {};
          entries.forEach((a) => {
            const m = a.name.match(/-(64|128|256|512)\./);
            if (m) variants[m[1]] = a.url;
          });
          if (Object.keys(variants).length) setLastVariants(variants);
        } catch {
          /* ignore asset listing errors */
        }
      } catch (err) {
        console.error('Failed to load branding settings', err);
        if (!cancelled) {
          setForm({ ...emptyBranding });
        }
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
      toast.success('Branding settings updated successfully');
      // Trigger global theme refresh so new colors/logos propagate immediately
      window.dispatchEvent(new Event('tenant-theme:refresh'));
    } catch (err) {
      toast.error('Failed to save branding settings');
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
      window.dispatchEvent(new Event('tenant-theme:refresh'));
      toast.success('File uploaded successfully');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      toast.error('Upload failed');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Identity Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FaIdCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Brand Identity</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Basic information about your business</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Public Name
              </label>
              <input 
                value={form.public_name} 
                onChange={e => update('public_name', e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors dark:bg-gray-700 dark:text-white" 
                placeholder="Your Business Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Short Name
              </label>
              <input 
                value={form.short_name} 
                onChange={e => update('short_name', e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors dark:bg-gray-700 dark:text-white" 
                placeholder="Short Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Support Email
              </label>
              <input 
                type="email" 
                value={form.support_email} 
                onChange={e => update('support_email', e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors dark:bg-gray-700 dark:text-white" 
                placeholder="support@yourcompany.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Support Phone
              </label>
              <input 
                value={form.support_phone} 
                onChange={e => update('support_phone', e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors dark:bg-gray-700 dark:text-white" 
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Colors Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <FaPalette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Brand Colors</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Define your color palette and theme</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['primary_color', 'secondary_color', 'accent_color'] as const).map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input 
                      type="color" 
                      value={form[key] || '#000000'} 
                      onChange={e => update(key, e.target.value)} 
                      className="h-12 w-16 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input 
                      value={form[key]} 
                      onChange={e => update(key, e.target.value)} 
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors dark:bg-gray-700 dark:text-white font-mono text-sm" 
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Color Preview */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-4">
              <FaEye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Color Preview</span>
            </div>
            <div key={previewKey} className="flex flex-wrap gap-4">
              {[
                { label: 'Primary', value: form.primary_color, bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Secondary', value: form.secondary_color, bg: 'bg-gray-50 dark:bg-gray-900' },
                { label: 'Accent', value: form.accent_color, bg: 'bg-purple-50' }
              ].map(color => (
                <div key={color.label} className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${color.bg} border`}>
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm" 
                    style={{ backgroundColor: color.value || '#ffffff' }}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{color.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{color.value || 'Not set'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Logos & Icons Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <FaImage className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Logos & Icons</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload or provide URLs for your brand assets</p>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {field.label}
                </label>
                <input 
                  value={form[field.key as keyof BrandingForm]} 
                  onChange={e => update(field.key as keyof BrandingForm, e.target.value)} 
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors dark:bg-gray-700 dark:text-white" 
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          {/* File Uploads */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center space-x-3 mb-6">
              <FaUpload className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Files</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'logo_light', label: 'Light Logo', accept: 'image/*' },
                { key: 'logo_dark', label: 'Dark Logo', accept: 'image/*' },
                { key: 'favicon', label: 'Favicon', accept: 'image/*,.ico' },
                { key: 'app_icon', label: 'App Icon', accept: 'image/*' }
              ].map(upload => (
                <div key={upload.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:border-gray-600 transition-colors dark:bg-gray-700 dark:text-white">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                      <div className="flex items-center justify-center px-4 py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 transition-colors dark:bg-gray-700 dark:text-white">
                        {uploading === upload.key ? (
                          <div className="flex items-center space-x-2">
                            <LoadingSpinner size="sm" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">Uploading...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <FaUpload className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">Choose file</span>
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
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
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
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
            </div>
          )}

          {/* Generated Variants */}
          {lastVariants && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-4">
                <FaEye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated Variants</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(lastVariants).map(([size, url]) => (
                  <div key={size} className="flex flex-col items-center space-y-2 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <img src={url} alt={`${size}px`} className="w-12 h-12 object-contain rounded" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{size}px</span>
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
  );
};

const OrganizationSettings: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'branding'>('profile');

  if (authLoading) return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;

  return (
    <AdminPageContainer
      title="My Business"
      description="Manage your business profile, branding, and administrators"
    >
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`${
              activeTab === 'profile'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Business Profile
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`${
              activeTab === 'branding'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Branding & Appearance
          </button>
        </nav>
      </div>

      {activeTab === 'profile' && <ProfileSettings user={user} />}
      {activeTab === 'branding' && <BrandingSettings user={user} />}
    </AdminPageContainer>
  );
};

export default OrganizationSettings;
