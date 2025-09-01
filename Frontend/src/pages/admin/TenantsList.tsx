import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/api';
import Pagination from '../../components/Pagination';
import PageLayout from '../../components/PageLayout';
import { useAuth } from '../../auth/AuthProvider';
import { HiOfficeBuilding, HiPlus, HiPencil, HiSearch } from 'react-icons/hi';

interface ApiTenant {
  id: string;
  name: string;
  loyalty_type: string;
  admin_ids: number[];
  vertical_type?: string;
  primary_domain?: string;
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
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.vertical_type && t.vertical_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getVerticalBadge = (vertical: string) => {
    const colors: Record<string, string> = {
      carwash: 'bg-blue-100 text-blue-800',
      dispensary: 'bg-green-100 text-green-800',
      padel: 'bg-orange-100 text-orange-800',
      flowershop: 'bg-pink-100 text-pink-800',
      beauty: 'bg-purple-100 text-purple-800',
    };
    return colors[vertical] || 'bg-gray-100 text-gray-800';
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <HiOfficeBuilding className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
                <p className="text-gray-600">Manage tenant organizations and their configurations</p>
              </div>
            </div>
            <Link
              to="/admin/tenants/new"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <HiPlus className="w-4 h-4 mr-2" />
              Create Tenant
            </Link>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>{filtered.length} of {tenants.length} tenants</span>
            </div>
          </div>

          {/* Tenants Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginated.map(tenant => (
              <div key={tenant.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{tenant.name}</h3>
                      {tenant.vertical_type && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getVerticalBadge(tenant.vertical_type)}`}>
                          {tenant.vertical_type}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">ID: {tenant.id}</p>
                    <p className="text-sm text-gray-600">Loyalty: {tenant.loyalty_type}</p>
                    {tenant.primary_domain && (
                      <p className="text-sm text-blue-600 hover:text-blue-800">
                        <a href={`https://${tenant.primary_domain}`} target="_blank" rel="noopener noreferrer">
                          {tenant.primary_domain}
                        </a>
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/admin/tenants/${tenant.id}/edit`}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="Edit tenant"
                  >
                    <HiPencil className="w-4 h-4" />
                  </Link>
                </div>
                
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {tenant.admin_ids.length} admin{tenant.admin_ids.length !== 1 ? 's' : ''}
                    </span>
                    <Link
                      to={`/admin/tenants/${tenant.id}/edit`}
                      className="text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Manage →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {paginated.length === 0 && (
            <div className="text-center py-12">
              <HiOfficeBuilding className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tenants found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search criteria.' : 'Get started by creating a new tenant.'}
              </p>
              {!searchTerm && (
                <div className="mt-6">
                  <Link
                    to="/admin/tenants/new"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700"
                  >
                    <HiPlus className="w-4 h-4 mr-2" />
                    Create your first tenant
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default TenantsList;
