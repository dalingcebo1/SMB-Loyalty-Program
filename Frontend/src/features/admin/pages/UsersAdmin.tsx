import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaSearch, FaUserPlus, FaUsers, FaCheck, FaTimes, FaEdit, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { HiOutlineRefresh } from 'react-icons/hi';
import api from '../../../api/api';
import { useCapabilities } from '../hooks/useCapabilities';
import LoadingSpinner from '../../../components/LoadingSpinner';
// import { useAuth } from '../../../auth/AuthProvider';
// import { Link } from 'react-router-dom'; // removed dedicated page link usage

interface ApiUser {
  id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  role: string;
}

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const h = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(h); }, [value, delay]);
  return debounced;
}

const pageSize = 10;
const sortable: (keyof ApiUser)[] = ['first_name','last_name','email','role'];

const badgeColors: Record<string,string> = {
  admin: 'bg-indigo-100 text-indigo-700 ring-indigo-600/20',
  staff: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
  user: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  developer: 'bg-pink-100 text-pink-700 ring-pink-600/20',
  superadmin: 'bg-purple-100 text-purple-700 ring-purple-600/20'
};

const UsersAdmin: React.FC = () => {
  const { has } = useCapabilities();
  // const { user } = useAuth(); // not currently needed; capability hook already guards features
  const canInvite = has('users.invite');
  const canEditRole = has('users.role.update');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<keyof ApiUser>('first_name');
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingRole, setPendingRole] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({
    email: '', password: '', first_name: '', last_name: '', phone: '', tenant_id: 'default'
  });
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'user'
  });
  const [searchParams, setSearchParams] = useSearchParams();
  // const navigate = useNavigate(); // currently unused

  const debouncedSearch = useDebounce(search, 300);
  const qc = useQueryClient();

  const fetchUsers = useCallback<() => Promise<UsersPage>>(() => api.get('/users', {
    params: { page, per_page: pageSize, search: debouncedSearch || undefined, sort_by: sortBy, sort_order: sortOrder }
  }).then(r => r.data as UsersPage), [page, debouncedSearch, sortBy, sortOrder]);

  interface UsersPage { items: ApiUser[]; total: number }
  const { data, isLoading, isError, error, refetch } = useQuery<UsersPage, Error>({
    queryKey: ['users-admin', page, debouncedSearch, sortBy, sortOrder],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  // Role update mutation (FastAPI expects query param new_role)
  interface UsersPage { items: ApiUser[]; total: number }
  const roleMutation = useMutation({
    mutationFn: ({ id, newRole }: { id: number; newRole: string }) => api.patch(`/auth/users/${id}/role`, null, { params: { new_role: newRole } }).then(r => r.data),
    onMutate: async ({ id, newRole }) => {
      await qc.cancelQueries({ queryKey: ['users-admin', page, debouncedSearch, sortBy, sortOrder] });
      const prev = qc.getQueryData<UsersPage>(['users-admin', page, debouncedSearch, sortBy, sortOrder]);
      qc.setQueryData<UsersPage | undefined>(['users-admin', page, debouncedSearch, sortBy, sortOrder], (old) => {
        if(!old) return old; return { ...old, items: old.items.map((u) => u.id === id ? { ...u, role: newRole } : u) };
      });
      return { prev } as { prev?: UsersPage };
    },
    onError: (_e, _vars, ctx) => { const c = ctx as { prev?: UsersPage }; if(c?.prev) qc.setQueryData(['users-admin', page, debouncedSearch, sortBy, sortOrder], c.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['users-admin'] }); setEditingId(null); },
  });

  const users: ApiUser[] = useMemo(() => (data ? data.items : []), [data]);
  const roleCounts = useMemo(() => users.reduce<Record<string,number>>((acc: Record<string,number>, u: ApiUser) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {}), [users]);

  // Open staff modal if query param present
  useEffect(() => {
    if (searchParams.get('registerStaff') === '1') {
      setShowStaff(true);
    }
  }, [searchParams]);

  const totalAdmins = roleCounts['admin'] || 0;

  const startItem = (page-1)*pageSize + 1;
  const endItem = (page-1)*pageSize + users.length;

  const handleHeaderSort = (key: keyof ApiUser) => {
    if (sortBy === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSortBy(key); setSortOrder('asc'); }
  };

  const createMutation = useMutation({
    mutationFn: () => api.post('/users/manual', {
      email: createForm.email,
      password: createForm.password,
      first_name: createForm.first_name || undefined,
      last_name: createForm.last_name || undefined,
      phone: createForm.phone || undefined,
      role: createForm.role,
    }).then(r => r.data as ApiUser),
    onSuccess: () => {
      setShowCreate(false);
      setCreateForm({ email: '', password: '', first_name: '', last_name: '', phone: '', role: 'user' });
      qc.invalidateQueries({ queryKey: ['users-admin'] });
    },
  });

  const canAddUser = canInvite; // reuse invite permission for manual add

  const staffMutation = useMutation({
    mutationFn: () => api.post('/auth/register-staff', {
      email: staffForm.email,
      password: staffForm.password,
      first_name: staffForm.first_name,
      last_name: staffForm.last_name,
      phone: staffForm.phone,
      tenant_id: staffForm.tenant_id,
    }).then(r => r.data),
    onSuccess: () => {
      setShowStaff(false);
      setStaffForm({ email:'', password:'', first_name:'', last_name:'', phone:'', tenant_id:'default' });
      // Remove query param if present
      if (searchParams.get('registerStaff')) {
        searchParams.delete('registerStaff');
        setSearchParams(searchParams, { replace: true });
      }
      qc.invalidateQueries({ queryKey: ['users-admin'] });
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FaUsers className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
              <p className="text-sm text-gray-500">{data?.total ?? 0} total users</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {canAddUser && (
              <>
                <button 
                  onClick={() => { setShowStaff(true); setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('registerStaff','1'); return p; }, { replace:true }); }} 
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <FaUserPlus className="w-4 h-4 mr-2" />
                  Register Staff
                </button>
                <button 
                  onClick={() => setShowCreate(true)} 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <FaUserPlus className="w-4 h-4 mr-2" />
                  Add User
                </button>
              </>
            )}
            <button 
              onClick={() => refetch()} 
              disabled={isLoading} 
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <HiOutlineRefresh className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FaUsers className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">{data?.total ?? '—'}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-50 rounded-lg">
                <FaUsers className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Admins</p>
                <p className="text-2xl font-semibold text-gray-900">{totalAdmins}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-50 rounded-lg">
                <FaUsers className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Page</p>
                <p className="text-2xl font-semibold text-gray-900">{page}/{totalPages}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={e => { setPage(1); setSearch(e.target.value); }}
            />
            {debouncedSearch && (
              <button 
                onClick={() => setSearch('')} 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-500">Loading users...</span>
            </div>
          )}
          
          {!isLoading && users.length === 0 && (
            <div className="text-center py-12">
              <FaUsers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No users found.</p>
              {debouncedSearch && (
                <button 
                  onClick={() => setSearch('')}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {!isLoading && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    {sortable.map(k => (
                      <th key={k} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button 
                          onClick={() => handleHeaderSort(k)} 
                          className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                        >
                          <span>{k === 'first_name' ? 'First Name' : k === 'last_name' ? 'Last Name' : k === 'email' ? 'Email' : 'Role'}</span>
                          {sortBy === k ? (
                            sortOrder === 'asc' ? <FaSortUp className="w-3 h-3" /> : <FaSortDown className="w-3 h-3" />
                          ) : (
                            <FaSort className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {u.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {u.first_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {u.last_name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === u.id ? (
                          <select
                            value={pendingRole}
                            onChange={e => setPendingRole(e.target.value)}
                            className="rounded-lg border border-gray-300 px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            autoFocus
                            onBlur={() => setEditingId(null)}
                          >
                            {['user','staff','admin','developer'].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badgeColors[u.role] || 'bg-gray-100 text-gray-700 ring-gray-500/20'} ring-1 ring-inset`}>
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId === u.id ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onMouseDown={() => { 
                                if(pendingRole && pendingRole !== u.role) 
                                  roleMutation.mutate({ id: u.id, newRole: pendingRole }); 
                                else 
                                  setEditingId(null); 
                              }}
                              className="inline-flex items-center px-3 py-1 bg-blue-600 border border-transparent rounded-lg text-xs text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              <FaCheck className="w-3 h-3 mr-1" />
                              Save
                            </button>
                            <button 
                              onMouseDown={() => { setEditingId(null); setPendingRole(u.role); }} 
                              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              <FaTimes className="w-3 h-3 mr-1" />
                              Cancel
                            </button>
                          </div>
                        ) : canEditRole ? (
                          <button 
                            onClick={() => { setEditingId(u.id); setPendingRole(u.role); }} 
                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            <FaEdit className="w-3 h-3 mr-1" />
                            Edit Role
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {isError && (
            <div className="bg-red-50 border-t border-red-200 p-4">
              <p className="text-sm text-red-600">{error?.message || 'Failed to load users'}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {startItem}-{endItem} of {data?.total ?? 0} users
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button 
                  disabled={page === totalPages} 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add User</h2>
              <button 
                onClick={() => setShowCreate(false)} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input 
                      value={createForm.first_name} 
                      onChange={e => setCreateForm(f => ({...f, first_name: e.target.value}))} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input 
                      value={createForm.last_name} 
                      onChange={e => setCreateForm(f => ({...f, last_name: e.target.value}))} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="email" 
                    required 
                    value={createForm.email} 
                    onChange={e => setCreateForm(f => ({...f, email: e.target.value}))} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="password" 
                    required 
                    value={createForm.password} 
                    onChange={e => setCreateForm(f => ({...f, password: e.target.value}))} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input 
                    value={createForm.phone} 
                    onChange={e => setCreateForm(f => ({...f, phone: e.target.value}))} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select 
                    value={createForm.role} 
                    onChange={e => setCreateForm(f => ({...f, role: e.target.value}))} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  >
                    {['user','staff','admin','developer'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              
              {createMutation.isError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{(createMutation.error as Error)?.message || 'Create failed'}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => setShowCreate(false)} 
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending} 
                  className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                >
                  {createMutation.isPending && <LoadingSpinner size="sm" color="white" />}
                  {createMutation.isPending ? (
                    <span className="ml-2">Creating...</span>
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Staff Modal */}
      {showStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Register Staff</h2>
              <button 
                onClick={() => { setShowStaff(false); searchParams.delete('registerStaff'); setSearchParams(searchParams,{replace:true}); }} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); staffMutation.mutate(); }} className="p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input 
                      value={staffForm.first_name} 
                      onChange={e => setStaffForm(f => ({...f, first_name: e.target.value}))} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input 
                      value={staffForm.last_name} 
                      onChange={e => setStaffForm(f => ({...f, last_name: e.target.value}))} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="email" 
                    required 
                    value={staffForm.email} 
                    onChange={e => setStaffForm(f => ({...f, email: e.target.value}))} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="password" 
                    required 
                    value={staffForm.password} 
                    onChange={e => setStaffForm(f => ({...f, password: e.target.value}))} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <input 
                    value={staffForm.phone} 
                    onChange={e => setStaffForm(f => ({...f, phone: e.target.value}))} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                  />
                </div>
              </div>
              
              {staffMutation.isError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{(staffMutation.error as Error)?.message || 'Registration failed'}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => { setShowStaff(false); searchParams.delete('registerStaff'); setSearchParams(searchParams,{replace:true}); }} 
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={staffMutation.isPending} 
                  className="px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                >
                  {staffMutation.isPending && <LoadingSpinner size="sm" color="white" />}
                  {staffMutation.isPending ? (
                    <span className="ml-2">Registering...</span>
                  ) : (
                    'Register Staff'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersAdmin;
