import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../api/api';
import { useCapabilities } from '../hooks/useCapabilities';
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-gray-500">Search, paginate and adjust roles. ({data?.total ?? 0} total)</p>
        </div>
        <div className="flex gap-2">
          {canAddUser && (
            <button onClick={()=> { setShowStaff(true); setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('registerStaff','1'); return p; }, { replace:true }); }} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">
              + Register Staff
            </button>
          )}
          {canAddUser && (
            <button onClick={()=> setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600">
              + Add User
            </button>
          )}
          <button onClick={() => refetch()} disabled={isLoading} className="rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50 disabled:opacity-50">{isLoading ? 'Refreshing…':'Refresh'}</button>
        </div>
      </div>
      {/* Stats bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs uppercase text-gray-500">Total Users (all pages)</div>
          <div className="mt-1 text-xl font-semibold">{data?.total ?? '—'}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs uppercase text-gray-500">Admins (this page)</div>
          <div className="mt-1 text-xl font-semibold">{totalAdmins}</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-xs uppercase text-gray-500">Page</div>
          <div className="mt-1 text-xl font-semibold">{page}/{totalPages}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1 relative">
          <input
            className="w-full rounded-md border px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={e => { setPage(1); setSearch(e.target.value); }}
          />
          {debouncedSearch && (
            <button onClick={()=> setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700">✕</button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Rows {startItem}-{endItem}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-gray-600">ID</th>
              {sortable.map(k => (
                <th key={k} className="px-3 py-2 font-medium text-gray-600">
                  <button onClick={()=>handleHeaderSort(k)} className="inline-flex items-center gap-1 hover:underline">
                    {k === 'first_name' ? 'First' : k === 'last_name' ? 'Last' : k === 'email' ? 'Email' : 'Role'}
                    {sortBy === k && (
                      <span className="text-[10px]">{sortOrder === 'asc' ? '▲':'▼'}</span>
                    )}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Loading users…</td></tr>
            )}
            {(!isLoading && users.length === 0) && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No users found.</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{u.id}</td>
                <td className="px-3 py-2">{u.first_name || '—'}</td>
                <td className="px-3 py-2">{u.last_name || '—'}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  {editingId === u.id ? (
                    <select
                      value={pendingRole}
                      onChange={e => setPendingRole(e.target.value)}
                      className="rounded border px-2 py-1 text-xs"
                      autoFocus
                      onBlur={() => setEditingId(null)}
                    >
                      {['user','staff','admin','developer'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${badgeColors[u.role] || 'bg-gray-100 text-gray-700 ring-gray-500/20'}`}>{u.role}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {editingId === u.id ? (
                    <div className="inline-flex gap-1">
                      <button
                        onMouseDown={() => { if(pendingRole && pendingRole !== u.role) roleMutation.mutate({ id: u.id, newRole: pendingRole }); else setEditingId(null); }}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
                      >Save</button>
                      <button onMouseDown={()=> { setEditingId(null); setPendingRole(u.role); }} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">Cancel</button>
                    </div>
                  ) : canEditRole ? (
                    <button onClick={()=> { setEditingId(u.id); setPendingRole(u.role); }} className="rounded border px-2 py-1 text-xs hover:bg-gray-50">Edit Role</button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isError && (
          <div className="border-t bg-red-50 px-3 py-2 text-sm text-red-600">{error?.message || 'Failed to load users'}</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-gray-500">Showing {startItem}-{endItem} of {data?.total ?? 0}</div>
          <div className="flex items-center gap-2">
            <button disabled={page===1} onClick={()=> setPage(p => Math.max(1,p-1))} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Prev</button>
            <span className="text-xs">Page {page} / {totalPages}</span>
            <button disabled={page===totalPages} onClick={()=> setPage(p => Math.min(totalPages,p+1))} className="rounded border px-2 py-1 text-xs disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex items-start justify-between border-b px-5 py-3">
              <h2 className="text-lg font-semibold">Add User</h2>
              <button onClick={()=> setShowCreate(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4 px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm space-y-1">
                  <span className="font-medium">First Name</span>
                  <input value={createForm.first_name} onChange={e=> setCreateForm(f=> ({...f, first_name: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Last Name</span>
                  <input value={createForm.last_name} onChange={e=> setCreateForm(f=> ({...f, last_name: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Email *</span>
                  <input type="email" required value={createForm.email} onChange={e=> setCreateForm(f=> ({...f, email: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Password *</span>
                  <input type="password" required value={createForm.password} onChange={e=> setCreateForm(f=> ({...f, password: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Phone</span>
                  <input value={createForm.phone} onChange={e=> setCreateForm(f=> ({...f, phone: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Role</span>
                  <select value={createForm.role} onChange={e=> setCreateForm(f=> ({...f, role: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['user','staff','admin','developer'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              </div>
              {createMutation.isError && (<div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{(createMutation.error as Error)?.message || 'Create failed'}</div>)}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=> setShowCreate(false)} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-green-500 disabled:opacity-50">{createMutation.isPending ? 'Saving…':'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Staff Modal */}
      {showStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex items-start justify-between border-b px-5 py-3">
              <h2 className="text-lg font-semibold">Register Staff</h2>
              <button onClick={()=> { setShowStaff(false); searchParams.delete('registerStaff'); setSearchParams(searchParams,{replace:true}); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); staffMutation.mutate(); }} className="space-y-4 px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm space-y-1">
                  <span className="font-medium">First Name</span>
                  <input value={staffForm.first_name} onChange={e=> setStaffForm(f=> ({...f, first_name: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1">
                  <span className="font-medium">Last Name</span>
                  <input value={staffForm.last_name} onChange={e=> setStaffForm(f=> ({...f, last_name: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Email *</span>
                  <input type="email" required value={staffForm.email} onChange={e=> setStaffForm(f=> ({...f, email: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Password *</span>
                  <input type="password" required value={staffForm.password} onChange={e=> setStaffForm(f=> ({...f, password: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="text-sm space-y-1 sm:col-span-2">
                  <span className="font-medium">Phone</span>
                  <input value={staffForm.phone} onChange={e=> setStaffForm(f=> ({...f, phone: e.target.value}))} className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              </div>
              {staffMutation.isError && (<div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{(staffMutation.error as Error)?.message || 'Failed'}</div>)}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=> { setShowStaff(false); searchParams.delete('registerStaff'); setSearchParams(searchParams,{replace:true}); }} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={staffMutation.isPending} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:opacity-50">{staffMutation.isPending ? 'Registering…':'Register Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersAdmin;
