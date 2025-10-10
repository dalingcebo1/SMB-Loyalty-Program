import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { FaSearch, FaEye, FaUsers, FaSort, FaSortUp, FaSortDown, FaFilter } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../../api/api';
import { useCapabilities } from '../hooks/useCapabilities';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { formatCurrency } from '../../../utils/format';

interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  created_at: string;
  order_count: number;
  total_spent: number;
  loyalty_points: number;
  last_order_date: string | null;
}

interface CustomerResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const pageSize = 20;

const CustomersAdmin: React.FC = () => {
  const { has: hasCapability } = useCapabilities();
  const canManageCustomers = hasCapability('manage_customers');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL state management
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';
  const roleFilter = searchParams.get('role') || '';
  
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 300);
  
  // Update URL when debounced search changes
  React.useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (debouncedSearch) {
      newParams.set('search', debouncedSearch);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1'); // Reset to first page on search
    setSearchParams(newParams);
  }, [debouncedSearch, setSearchParams, searchParams]);

  const updateSort = useCallback((field: keyof Customer) => {
    const newParams = new URLSearchParams(searchParams);
    if (sortBy === field) {
      newParams.set('sort_order', sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      newParams.set('sort_by', field);
      newParams.set('sort_order', 'asc');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  }, [sortBy, sortOrder, searchParams, setSearchParams]);

  const updateFilter = useCallback((field: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(field, value);
    } else {
      newParams.delete(field);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const { data, isLoading, error, isError } = useQuery<CustomerResponse>({
    queryKey: ['admin-customers', page, debouncedSearch, sortBy, sortOrder, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (roleFilter) params.set('role', roleFilter);
      
      const response = await api.get(`/customers?${params.toString()}`);
      return response.data;
    },
    staleTime: 30000, // 30 seconds
    enabled: canManageCustomers,
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
  }, [queryClient]);

  const SortIcon: React.FC<{ field: keyof Customer }> = ({ field }) => {
    if (sortBy !== field) return <FaSort className="text-gray-400" />;
    return sortOrder === 'asc' ? <FaSortUp className="text-blue-600" /> : <FaSortDown className="text-blue-600" />;
  };

  // Check permissions
  if (!canManageCustomers) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You don't have permission to manage customers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600">Manage and view customer information, orders, and loyalty data</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <HiOutlineRefresh className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search customers by name, email, or phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <FaFilter className="text-gray-400 w-4 h-4" />
            <select
              value={roleFilter}
              onChange={(e) => updateFilter('role', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Users</option>
              <option value="user">Customers Only</option>
              <option value="staff">Staff Only</option>
              <option value="admin">Admins Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <LoadingSpinner />
            <p className="mt-2 text-gray-600">Loading customers...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">Failed to load customers: {error?.message}</p>
            </div>
          </div>
        ) : data && data.customers.length === 0 ? (
          <div className="p-8 text-center">
            <FaUsers className="mx-auto w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No customers found</p>
            {(debouncedSearch || roleFilter) && (
              <p className="text-sm text-gray-500 mt-2">Try adjusting your search or filters</p>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-700">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data?.total || 0)} of {data?.total || 0} customers
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => updateSort('first_name')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Customer
                        <SortIcon field="first_name" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => updateSort('email')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Contact
                        <SortIcon field="email" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => updateSort('order_count')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Orders
                        <SortIcon field="order_count" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => updateSort('total_spent')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Total Spent
                        <SortIcon field="total_spent" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => updateSort('loyalty_points')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Loyalty Points
                        <SortIcon field="loyalty_points" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => updateSort('created_at')}
                        className="flex items-center gap-1 hover:text-gray-700"
                      >
                        Joined
                        <SortIcon field="created_at" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {customer.first_name} {customer.last_name}
                          </p>
                          <p className="text-sm text-gray-500">ID: {customer.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm text-gray-900">{customer.email}</p>
                          {customer.phone && (
                            <p className="text-sm text-gray-500">{customer.phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          customer.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          customer.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {customer.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{customer.order_count}</div>
                        {customer.last_order_date && (
                          <div className="text-sm text-gray-500">
                            Last: {new Date(customer.last_order_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(customer.total_spent)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.loyalty_points} pts
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(customer.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/admin/customers/${customer.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 transition-colors"
                        >
                          <FaEye className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.total_pages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex justify-between flex-1 sm:hidden">
                    <button
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', Math.max(1, page - 1).toString());
                        setSearchParams(newParams);
                      }}
                      disabled={page <= 1}
                      className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', Math.min(data.total_pages, page + 1).toString());
                        setSearchParams(newParams);
                      }}
                      disabled={page >= data.total_pages}
                      className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Page <span className="font-medium">{page}</span> of{' '}
                        <span className="font-medium">{data.total_pages}</span>
                      </p>
                    </div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => {
                          const newParams = new URLSearchParams(searchParams);
                          newParams.set('page', Math.max(1, page - 1).toString());
                          setSearchParams(newParams);
                        }}
                        disabled={page <= 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(page - 2 + i, data.total_pages - 4 + i));
                        return (
                          <button
                            key={pageNum}
                            onClick={() => {
                              const newParams = new URLSearchParams(searchParams);
                              newParams.set('page', pageNum.toString());
                              setSearchParams(newParams);
                            }}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => {
                          const newParams = new URLSearchParams(searchParams);
                          newParams.set('page', Math.min(data.total_pages, page + 1).toString());
                          setSearchParams(newParams);
                        }}
                        disabled={page >= data.total_pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CustomersAdmin;
