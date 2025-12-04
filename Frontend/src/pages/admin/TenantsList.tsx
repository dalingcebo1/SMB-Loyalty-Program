import React, { useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/api';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../auth/AuthProvider';
import { useCapabilities } from '../../features/admin/hooks/useCapabilities';
import { HiOfficeBuilding, HiPlus, HiPencil, HiSearch, HiOutlineRefresh } from 'react-icons/hi';
import { AdminPageContainer, AdminGrid } from '../../features/admin/components/AdminGrid';
import { AdminCard, StatCard } from '../../features/admin/components/AdminCard';
import LoadingSpinner from '../../components/LoadingSpinner';

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
  const { has } = useCapabilities();
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
    return <div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>;
  }
  if (!user || !has('platform.manage_tenants')) {
    return <Navigate to="/admin" replace />;
  }

  // Filter & paginate
  const filtered = useMemo(() => tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.vertical_type && t.vertical_type.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [tenants, searchTerm]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stats
  const stats = useMemo(() => {
    const total = tenants.length;
    const verticals = new Set(tenants.map(t => t.vertical_type).filter(Boolean)).size;
    const withDomain = tenants.filter(t => t.primary_domain).length;
    return { total, verticals, withDomain };
  }, [tenants]);

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

  if (isError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Failed to load tenants: {error?.message}</p>
          <button onClick={() => refetch()} className="mt-2 text-blue-600 hover:text-blue-800">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <AdminPageContainer
      title="Tenants"
      description="Manage tenant organizations and their configurations"
      actions={
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => refetch()} 
            className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <HiOutlineRefresh className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/admin/tenants/new"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <HiPlus className="w-4 h-4 mr-2" />
            Create Tenant
          </Link>
        </div>
      }
    >
      {/* Stats Grid */}
      <AdminGrid cols={{ mobile: 1, tablet: 3, desktop: 3 }} className="mb-6">
        <StatCard
          label="Total Tenants"
          value={stats.total}
          icon={<HiOfficeBuilding className="w-5 h-5" />}
          className="border-purple-100"
        />
        <StatCard
          label="Active Verticals"
          value={stats.verticals}
          icon={<HiOfficeBuilding className="w-5 h-5" />}
          className="border-blue-100"
        />
        <StatCard
          label="With Custom Domain"
          value={stats.withDomain}
          icon={<HiOfficeBuilding className="w-5 h-5" />}
          className="border-green-100"
        />
      </AdminGrid>

      {/* Search */}
      <AdminCard className="mb-6">
        <div className="relative">
          <HiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search tenants by name, ID, or vertical..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors"
          />
        </div>
      </AdminCard>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Tenants Grid */}
      {!isLoading && paginated.length > 0 && (
        <>
          <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }} className="mb-6">
            {paginated.map(tenant => (
              <div key={tenant.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate text-lg">{tenant.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tenant.vertical_type && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVerticalBadge(tenant.vertical_type)}`}>
                          {tenant.vertical_type}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {tenant.loyalty_type}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/admin/tenants/${tenant.id}/edit`}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Edit tenant"
                  >
                    <HiPencil className="w-5 h-5" />
                  </Link>
                </div>
                
                <div className="mt-auto pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ID</span>
                    <span className="font-mono text-gray-700">{tenant.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Admins</span>
                    <span className="text-gray-700">{tenant.admin_ids.length}</span>
                  </div>
                  {tenant.primary_domain && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Domain</span>
                      <a 
                        href={`https://${tenant.primary_domain}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 truncate max-w-[150px]"
                      >
                        {tenant.primary_domain}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </AdminGrid>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!isLoading && paginated.length === 0 && (
        <AdminCard className="text-center py-12">
          <HiOfficeBuilding className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No tenants found</h3>
          <p className="mt-1 text-gray-500">
            {searchTerm ? 'Try adjusting your search criteria.' : 'Get started by creating a new tenant.'}
          </p>
          {!searchTerm && (
            <div className="mt-6">
              <Link
                to="/admin/tenants/new"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
              >
                <HiPlus className="w-4 h-4 mr-2" />
                Create your first tenant
              </Link>
            </div>
          )}
        </AdminCard>
      )}
    </AdminPageContainer>
  );
};

export default TenantsList;
