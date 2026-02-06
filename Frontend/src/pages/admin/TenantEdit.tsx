import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { useCapabilities } from '../../features/admin/hooks/useCapabilities';
import api from '../../api/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tenantSchema, TenantForm } from '../../schemas';
import { AdminPageContainer } from '../../features/admin/components/AdminGrid';
import { AdminCard } from '../../features/admin/components/AdminCard';
import { Breadcrumb } from '../../features/admin/components/Breadcrumb';
import { HiSave, HiTrash, HiPlus, HiArrowLeft, HiMail } from 'react-icons/hi';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';

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

const TenantEdit: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { has } = useCapabilities();
  const navigate = useNavigate();
  const isNew = tenantId === 'new';
  const [tenantData, setTenantData] = useState<ApiTenant>({ 
    id: '', name: '', loyalty_type: '', vertical_type: 'carwash', admin_ids: [], config: {} 
  });
  const [error, setError] = useState<string>('');
  const [newAdminId, setNewAdminId] = useState<number | ''>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // React Hook Form setup
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TenantForm>({
    resolver: zodResolver(tenantSchema),
  });

  useEffect(() => {
    if (!isNew && tenantId) {
      setIsLoading(true);
      api.get<ApiTenant>(`/tenants/${tenantId}`)
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
        .catch(err => setError(err.response?.data?.detail || 'Error loading tenant'))
        .finally(() => setIsLoading(false));
    }
  }, [tenantId, isNew, reset]);

  const onSubmit = handleSubmit(async data => {
    try {
      const payload = {
        ...data,
        config: data.config ? JSON.parse(data.config) : {}
      };

      if (isNew) {
        await api.post<ApiTenant>('/tenants/', { id: tenantData.id, ...payload });
      } else {
        await api.patch<ApiTenant>(`/tenants/${tenantId}`, payload);
      }
      toast.success(isNew ? 'Tenant created successfully' : 'Tenant updated successfully');
      navigate('/admin/tenants');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const msg = error.response?.data?.detail || 'Save failed';
      setError(msg);
      toast.error(msg);
    }
  });

  const handleAssignAdmin = () => {
    if (!newAdminId || !tenantId) return;
    api.post<ApiTenant>(`/tenants/${tenantId}/admins`, { user_id: newAdminId })
      .then(res => {
        setTenantData(res.data);
        toast.success('Admin assigned successfully');
      })
      .catch(err => toast.error(err.response?.data?.detail || 'Assign failed'));
    setNewAdminId('');
  };

  const handleRemoveAdmin = (id: number) => {
    if (!tenantId) return;
    api.delete<ApiTenant>(`/tenants/${tenantId}/admins/${id}`)
      .then(res => {
        setTenantData(res.data);
        toast.success('Admin removed successfully');
      })
      .catch(err => toast.error(err.response?.data?.detail || 'Remove failed'));
  };

  const handleInvite = async () => {
    if (!inviteEmail || !tenantId) return;
    setIsInviting(true);
    try {
      const res = await api.post(`tenants/${tenantId}/invite`, { email: inviteEmail });
      toast.success(`Invite sent! Token: ${res.data.token}`);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invite failed');
    } finally {
      setIsInviting(false);
    }
  };

  if (authLoading) return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
  if (!user || !has('platform.manage_tenants')) return <Navigate to='/' replace />;
  
  if (isLoading) {
    return (
      <AdminPageContainer title={isNew ? 'Create Tenant' : 'Edit Tenant'}>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer
      title={isNew ? 'Create Tenant' : `Edit Tenant: ${tenantData.name || tenantId}`}
      description={isNew ? 'Add a new tenant organization' : `Manage configuration for ${tenantId}`}
      breadcrumbs={
        <Breadcrumb
          items={[
            { label: 'Tenants', href: '/admin/tenants' },
            { label: isNew ? 'Create' : tenantData.name || 'Edit' },
          ]}
        />
      }
      actions={
        <button
          onClick={() => navigate('/admin/tenants')}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <HiArrowLeft className="w-4 h-4" />
          Back
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <AdminCard title="Tenant Details">
            <form onSubmit={onSubmit} className="space-y-4">
              {isNew && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                  <input
                    value={tenantData.id}
                    onChange={e => setTenantData({ ...tenantData, id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., my-company"
                  />
                  <p className="mt-1 text-xs text-gray-500">Unique identifier for the tenant (cannot be changed later)</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    {...register('name')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vertical Type</label>
                  <select
                    {...register('vertical_type')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loyalty Type</label>
                  <select
                    {...register('loyalty_type')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="points">Points Based</option>
                    <option value="visits">Visit Based</option>
                    <option value="stamps">Stamp Card</option>
                  </select>
                  {errors.loyalty_type && <p className="mt-1 text-sm text-red-600">{errors.loyalty_type.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Domain</label>
                  <input
                    {...register('primary_domain')}
                    placeholder="e.g., loyalty.example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      {...register('theme_color')}
                      className="h-10 w-20 p-1 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      {...register('theme_color')}
                      placeholder="#000000"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                  <input
                    {...register('logo_url')}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {errors.logo_url && <p className="mt-1 text-sm text-red-600">{errors.logo_url.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Configuration (JSON)</label>
                <textarea
                  {...register('config')}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="{}"
                />
                <p className="mt-1 text-xs text-gray-500">Advanced configuration in JSON format</p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center w-full sm:w-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <LoadingSpinner size="sm" color="white" /> : <HiSave className="w-4 h-4 mr-2" />}
                  {isNew ? 'Create Tenant' : 'Save Changes'}
                </button>
              </div>
            </form>
          </AdminCard>
        </div>

        {!isNew && (
          <div className="space-y-6">
            <AdminCard title="Administrators">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="User ID"
                    value={newAdminId}
                    onChange={e => setNewAdminId(Number(e.target.value) || '')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button 
                    onClick={handleAssignAdmin}
                    disabled={!newAdminId}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <HiPlus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {tenantData.admin_ids.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No admins assigned</p>
                  ) : (
                    tenantData.admin_ids.map((id: number) => (
                      <div key={id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">User ID: {id}</span>
                        <button
                          onClick={() => handleRemoveAdmin(id)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                          title="Remove admin"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
        )}
      </div>
    </AdminPageContainer>
  );
};

export default TenantEdit;
