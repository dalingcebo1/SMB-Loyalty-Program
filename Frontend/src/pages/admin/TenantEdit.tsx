import React, { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/api';

interface Tenant {
  id: string;
  name: string;
  loyalty_type: string;
  admin_ids: number[];
}

const TenantEdit: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const isNew = tenantId === 'new';
  const [tenant, setTenant] = useState<Tenant>({ id: '', name: '', loyalty_type: '', admin_ids: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [newAdminId, setNewAdminId] = useState<number | ''>('');

  useEffect(() => {
    if (!isNew && tenantId) {
      setLoading(true);
      api.get<Tenant>(`/tenants/${tenantId}`)
        .then(res => setTenant(res.data))
        .catch(err => setError(err.response?.data?.detail || 'Error loading tenant'))
        .finally(() => setLoading(false));
    }
  }, [tenantId, isNew]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name: tenant.name, loyalty_type: tenant.loyalty_type };
    const req = isNew
      ? api.post<Tenant>('/tenants/', { id: tenant.id, ...payload })
      : api.patch<Tenant>(`/tenants/${tenantId}`, payload);
    req.then(() => navigate('/admin/tenants'))
       .catch(err => setError(err.response?.data?.detail || 'Save failed'))
       .finally(() => setLoading(false));
  };

  const handleAssignAdmin = () => {
    if (!newAdminId || !tenantId) return;
    api.post<Tenant>(`/tenants/${tenantId}/admins`, { user_id: newAdminId })
      .then(res => setTenant(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Assign failed'));
    setNewAdminId('');
  };

  const handleRemoveAdmin = (id: number) => {
    if (!tenantId) return;
    api.delete<Tenant>(`/tenants/${tenantId}/admins/${id}`)
      .then(res => setTenant(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Remove failed'));
  };

  if (loading && !isNew) return <div>Loading tenant…</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{isNew ? 'Create Tenant' : `Edit Tenant ${tenantId}`}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        {isNew && (
          <div>
            <label className="block font-medium">ID</label>
            <input
              type="text"
              value={tenant.id}
              onChange={e => setTenant({ ...tenant, id: e.target.value })}
              required
              className="border p-2 w-full"
            />
          </div>
        )}
        <div>
          <label className="block font-medium">Name</label>
          <input
            type="text"
            value={tenant.name}
            onChange={e => setTenant({ ...tenant, name: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label className="block font-medium">Loyalty Type</label>
          <input
            type="text"
            value={tenant.loyalty_type}
            onChange={e => setTenant({ ...tenant, loyalty_type: e.target.value })}
            required
            className="border p-2 w-full"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {isNew ? 'Create' : 'Save'}
        </button>
      </form>
      {!isNew && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Admins</h2>
          <ul className="list-disc ml-6 mb-2">
            {tenant.admin_ids.map(id => (
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
  );
};

export default TenantEdit;
