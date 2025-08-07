import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/api';
import Pagination from '../../components/Pagination';
import PageLayout from '../../components/PageLayout';
import TextField from '../../components/ui/TextField';
import { useAuth } from '../../auth/AuthProvider';

interface ApiTenant {
  id: string;
  name: string;
  loyalty_type: string;
  admin_ids: number[];
}

const TenantsList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Fetch tenants via React Query
  const { data: tenants = [], isLoading, isError, error, refetch } = useQuery<ApiTenant[], Error>({
    queryKey: ['adminTenants'],
    queryFn: () => api.get<ApiTenant[]>('/tenants/').then(res => res.data),
  });

  // Auth guard
  if (authLoading) {
    return <PageLayout loading>{null}</PageLayout>;
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Loading & error
  if (isLoading) {
    return <PageLayout loading loadingText="Loading tenants...">{null}</PageLayout>;
  }
  if (isError) {
    return <PageLayout error={error?.message || 'Failed to load tenants'} onRetry={() => refetch()}>{null}</PageLayout>;
  }

  // Filter & paginate
  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <PageLayout>
      <div>
        <h1 className="text-2xl font-bold mb-4">Tenants</h1>
        <div className="mb-4">
          <TextField
            label="Search Tenants"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="overflow-x-auto mb-4">
          <table className="min-w-full bg-white shadow rounded-lg">
            <thead>
              <tr>
                <th className="px-4 py-2 border">ID</th>
                <th className="px-4 py-2 border">Name</th>
                <th className="px-4 py-2 border">Loyalty Type</th>
                <th className="px-4 py-2 border">Admins</th>
                <th className="px-4 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(t => (
                <tr key={t.id} className="hover:bg-gray-100">
                  <td className="px-4 py-2 border text-center">{t.id}</td>
                  <td className="px-4 py-2 border">{t.name}</td>
                  <td className="px-4 py-2 border">{t.loyalty_type}</td>
                  <td className="px-4 py-2 border">{t.admin_ids.join(', ')}</td>
                  <td className="px-4 py-2 border">
                    <Link
                      to={`/admin/tenants/${t.id}/edit`}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center">
          <Link to="/admin/tenants/new" className="bg-blue-500 text-white px-4 py-2 rounded">
            Create Tenant
          </Link>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </PageLayout>
  );
};

export default TenantsList;
