import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import api from '../../api/api';
import PageLayout from '../../components/PageLayout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import TextField from '../../components/ui/TextField';
import { tenantSchema, TenantForm } from '../../schemas';

// API tenant shape
interface ApiTenant {
  id: string;
  name: string;
  loyalty_type: string;
  admin_ids: number[];
}

const TenantEdit: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isNew = tenantId === 'new';
  const [tenantData, setTenantData] = useState<ApiTenant>({ id: '', name: '', loyalty_type: '', admin_ids: [] });
  const [error, setError] = useState<string>('');
  const [newAdminId, setNewAdminId] = useState<number | ''>('');

  // React Hook Form setup
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TenantForm>({
    resolver: zodResolver(tenantSchema),
  });

  useEffect(() => {
    if (!isNew && tenantId) {
      api.get<ApiTenant>(`/tenants/${tenantId}`)
        .then(res => {
          setTenantData(res.data);
          reset({ name: res.data.name, loyalty_type: res.data.loyalty_type });
        })
        .catch(err => setError(err.response?.data?.detail || 'Error loading tenant'));
    }
  }, [tenantId, isNew, reset]);

  const onSubmit = handleSubmit(async data => {
    try {
      if (isNew) {
        await api.post<ApiTenant>('/tenants/', { id: tenantData.id, ...data });
      } else {
        await api.patch<ApiTenant>(`/tenants/${tenantId}`, data);
      }
      navigate('/admin/tenants');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Save failed');
    }
  });

  const handleAssignAdmin = () => {
    if (!newAdminId || !tenantId) return;
    api.post<ApiTenant>(`/tenants/${tenantId}/admins`, { user_id: newAdminId })
      .then(res => setTenantData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Assign failed'));
    setNewAdminId('');
  };

  const handleRemoveAdmin = (id: number) => {
    if (!tenantId) return;
    api.delete<ApiTenant>(`/tenants/${tenantId}/admins/${id}`)
      .then(res => setTenantData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Remove failed'));
  };

  if (authLoading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to='/' replace />;
  if (error) return <PageLayout error={error} onRetry={() => window.location.reload()}>{null}</PageLayout>;
  return (
    <PageLayout>
      <div>
        <h1 className="text-2xl font-bold mb-4">{isNew ? 'Create Tenant' : `Edit Tenant ${tenantId}`}</h1>
        <form onSubmit={onSubmit} className="space-y-4 mb-6">
          {isNew && (
            <TextField
              label="Tenant ID"
              value={tenantData.id}
              onChange={e => setTenantData({ ...tenantData, id: e.target.value })}
              required
            />
          )}
          <TextField
            label="Name"
            {...register('name')}
            error={errors.name?.message}
          />
          <TextField
            label="Loyalty Type"
            {...register('loyalty_type')}
            error={errors.loyalty_type?.message}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {isNew ? 'Create' : 'Save'}
          </button>
        </form>
        {!isNew && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Admins</h2>
            <ul className="list-disc ml-6 mb-2">
              {tenantData.admin_ids.map((id: number) => (
                <li key={id}>
                  User {id}{' '}
                  <button
                    onClick={() => handleRemoveAdmin(id)}
                    className="text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="User ID"
                value={newAdminId}
                onChange={e => setNewAdminId(Number(e.target.value) || '')}
                className="border p-2"
              />
              <button onClick={handleAssignAdmin} className="bg-green-600 text-white px-3 py-1 rounded">
                Assign Admin
              </button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default TenantEdit;
