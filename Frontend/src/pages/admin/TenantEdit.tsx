import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import api from '../../api/api';
import PageLayout from '../../components/PageLayout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface Tenant {
  id: string;
  name: string;
  loyalty_type: string;
  admin_ids: number[];
}

// Validation schema for tenant form
const tenantSchema = z.object({
  name: z.string().nonempty('Name is required'),
  loyalty_type: z.string().nonempty('Loyalty type is required'),
});
type TenantForm = z.infer<typeof tenantSchema>;

const TenantEdit: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isNew = tenantId === 'new';
  const [tenantData, setTenantData] = useState<Tenant>({ id: '', name: '', loyalty_type: '', admin_ids: [] });
  const [error, setError] = useState<string>('');
  const [newAdminId, setNewAdminId] = useState<number | ''>('');

  // React Hook Form setup
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TenantForm>({
    resolver: zodResolver(tenantSchema),
  });

  useEffect(() => {
    if (!isNew && tenantId) {
      api.get<Tenant>(`/tenants/${tenantId}`)
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
        await api.post<Tenant>('/tenants/', { id: tenantData.id, ...data });
      } else {
        await api.patch<Tenant>(`/tenants/${tenantId}`, data);
      }
      navigate('/admin/tenants');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Save failed');
    }
  });

  const handleAssignAdmin = () => {
    if (!newAdminId || !tenantId) return;
    api.post<Tenant>(`/tenants/${tenantId}/admins`, { user_id: newAdminId })
      .then(res => setTenantData(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Assign failed'));
    setNewAdminId('');
  };

  const handleRemoveAdmin = (id: number) => {
    if (!tenantId) return;
    api.delete<Tenant>(`/tenants/${tenantId}/admins/${id}`)
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
            <div>
              <label className="block font-medium">ID</label>
              <input
                type="text"
                value={tenantData.id}
                onChange={e => setTenantData({ ...tenantData, id: e.target.value })}
                required
                className="border p-2 w-full"
              />
            </div>
          )}
          <div>
            <label className="block font-medium">Name</label>
            <input
              type="text"
              {...register('name')}
              className="border p-2 w-full"
            />
            {errors.name && <p className="text-red-600 text-sm">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block font-medium">Loyalty Type</label>
            <input
              type="text"
              {...register('loyalty_type')}
              className="border p-2 w-full"
            />
            {errors.loyalty_type && <p className="text-red-600 text-sm">{errors.loyalty_type.message}</p>}
          </div>
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
