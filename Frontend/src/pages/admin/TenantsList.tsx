import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { Navigate, Link } from 'react-router-dom';
import api from '../../api/api';
import PageLayout from '../../components/PageLayout';

interface Tenant {
  id: string;
  name: string;
  loyalty_type: string;
  admin_ids: number[];
}

const TenantsList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  if (authLoading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to='/' replace />;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Tenant[]>('/tenants/')
      .then(res => setTenants(res.data))
      .catch(err => setError(err.response?.data?.detail || 'Error loading tenants'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLayout loading loadingText="Loading tenants…">{null}</PageLayout>;
  if (error) return <PageLayout error={error} onRetry={() => window.location.reload()}>{null}</PageLayout>;

  return (
    <PageLayout>
      <div>
        <h1 className="text-2xl font-bold mb-4">Tenants</h1>
        <table className="min-w-full bg-white mb-4">
          <thead>
            <tr>
              <th className="py-2 px-4 border">ID</th>
              <th className="py-2 px-4 border">Name</th>
              <th className="py-2 px-4 border">Loyalty Type</th>
              <th className="py-2 px-4 border">Admins</th>
              <th className="py-2 px-4 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td className="py-2 px-4 border">{t.id}</td>
                <td className="py-2 px-4 border">{t.name}</td>
                <td className="py-2 px-4 border">{t.loyalty_type}</td>
                <td className="py-2 px-4 border">{t.admin_ids.join(', ')}</td>
                <td className="py-2 px-4 border">
                  <Link to={`/admin/tenants/${t.id}`} className="text-blue-600 hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link to="/admin/tenants/new" className="bg-blue-500 text-white px-4 py-2 rounded">
          Create Tenant
        </Link>
      </div>
    </PageLayout>
  );
};

export default TenantsList;
