// src/pages/admin/UsersList.tsx
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/api';
import PageLayout from '../../components/PageLayout';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../auth/AuthProvider';
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';
import ContentLoader from 'react-content-loader';
// @ts-ignore: react-modal has no types
import Modal from 'react-modal';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// API user shape
interface ApiUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

const UsersList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof ApiUser>('first_name');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  // Debounce hook
  function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
  }
  const debouncedSearch = useDebounce(searchTerm, 300);
  // fetch paginated users via API
  const fetchUsers = (page: number): Promise<{ items: ApiUser[]; total: number }> =>
    api.get('/users', {
      params: {
        page,
        per_page: pageSize,
        search: debouncedSearch,
        sort_by: sortKey,
        sort_order: 'asc',
      },
    }).then(res => res.data);
  // fetch and cache paginated users
  const { data, isLoading, isError, error, refetch } = useQuery<{ items: ApiUser[]; total: number }, Error>({
    queryKey: ['adminUsers', currentPage, debouncedSearch, sortKey],
    queryFn: () => fetchUsers(currentPage),
    staleTime: 1000 * 60 * 5,       // cache for 5 minutes
  });
  // derive list and pagination info
  const usersList = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;
  // prefetch next page for smooth pagination
  useEffect(() => {
    if (data && currentPage < totalPages) {
      queryClient.prefetchQuery({
        queryKey: ['adminUsers', currentPage + 1, debouncedSearch, sortKey],
        queryFn: () => fetchUsers(currentPage + 1),
      });
    }
  }, [data, currentPage, debouncedSearch, sortKey, totalPages, queryClient]);

  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: (id: number) => api.delete(`/users/${id}`).then(() => {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('User deleted');
    },
    onError: () => toast.error('Delete failed'),
  });
  // form state and mutation for editing user
  const [formData, setFormData] = useState<Partial<ApiUser>>({});
  const updateMutation = useMutation<ApiUser, Error, { id: number; data: Partial<ApiUser> }>({
    mutationFn: ({ id, data }) => api.patch(`/users/${id}`, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.success('User updated');
      setEditUser(null);
    },
    onError: () => toast.error('Update failed'),
  });


  if (authLoading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to='/' replace />;
  if (isError) return <PageLayout error={error?.message || 'Failed to load users'} onRetry={() => refetch()}>{null}</PageLayout>;

  // memoized skeleton row
  const LoadingRow = memo(() => (
    <ContentLoader
      speed={2}
      width="100%"
      height={40}
      backgroundColor="#f3f3f3"
      foregroundColor="#ecebeb"
    >
      <rect x="10" y="10" rx="4" ry="4" width="80%" height="20" />
    </ContentLoader>
  ));

  // memoized row renderer for virtualization
  interface RowData { users: ApiUser[]; onEdit: (u: ApiUser) => void; onDelete: (id: number) => void }
  const UserRow = memo(function UserRow({ index, style, data }: ListChildComponentProps<RowData>) {
    const u = data.users[index];
    return (
      <div
        role="row"
        tabIndex={0}
        style={style}
        className="grid grid-cols-6 items-center border-b hover:bg-gray-50 p-2"
      >
        <div role="cell" className="px-4 text-center">{u.id}</div>
        <div role="cell" className="px-4">{u.first_name} {u.last_name}</div>
        <div role="cell" className="px-4">{u.email}</div>
        <div role="cell" className="px-4">{u.phone}</div>
        <div role="cell" className="px-4 capitalize">{u.role}</div>
        <div role="cell" className="px-4 flex justify-center space-x-4">
          <button
            onClick={() => data.onEdit(u)}
            aria-label={`Edit ${u.first_name}`}
            className="text-blue-600 hover:underline"
          >Edit</button>
          <button
            onClick={() => data.onDelete(u.id)}
            aria-label={`Delete ${u.first_name}`}
            disabled={deleteMutation.status === 'pending'}
            className="text-red-600 hover:underline"
          >Delete</button>
        </div>
      </div>
    );
  });

  // stable callbacks for virtualization
  const handleEdit = useCallback((u: ApiUser) => {
    setEditUser(u);
    setFormData({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
    });
  }, []);
  const handleDelete = useCallback((id: number) => {
    if (confirm(`Delete user ${id}?`)) deleteMutation.mutate(id);
  }, [deleteMutation]);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortKey(e.target.value as keyof ApiUser);
  }, []);
  // memoized itemData to avoid re-renders
  const itemData = useMemo(() => ({ users: usersList, onEdit: handleEdit, onDelete: handleDelete }), [usersList, handleEdit, handleDelete]);

  return (
    <PageLayout>
      <ToastContainer position="bottom-right" />
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      {/* Toolbar: filter + sort */}
      <div className="flex mb-4">
        {/* search input */}
        <input
          aria-label="Filter users"
          placeholder="Search users..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="border p-2 flex-1 mr-2"
        />
        <select
          aria-label="Sort users"
          value={sortKey}
          onChange={handleSortChange}
          className="border p-2"
        >
          <option value="first_name">First Name</option>
          <option value="last_name">Last Name</option>
          <option value="email">Email</option>
          <option value="role">Role</option>
        </select>
      </div>
      {/* Loader or table */}
      {isLoading ? (
        Array.from({ length: 8 }).map((_, i) => <LoadingRow key={i} />)
      ) : (
        <>
          <div role="table" aria-label="Users" className="mb-4">
            {/* table header */}
            <div role="rowgroup" className="grid grid-cols-6 font-semibold border-b bg-gray-100 p-2">
              <div role="columnheader" className="px-4 text-center">ID</div>
              <div role="columnheader" className="px-4">Name</div>
              <div role="columnheader" className="px-4">Email</div>
              <div role="columnheader" className="px-4">Phone</div>
              <div role="columnheader" className="px-4">Role</div>
              <div role="columnheader" className="px-4">Actions</div>
            </div>
            <List
              height={400}
              itemCount={usersList.length}
              itemSize={50}
              width="100%"
              itemData={itemData}
            >
              {UserRow}
            </List>
          </div>
          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}
      {/* Edit modal */}
      {editUser && (
        <Modal
          isOpen
          onRequestClose={() => setEditUser(null)}
          contentLabel="Edit User"
          ariaHideApp={false}
        >
          <h2 className="text-xl font-bold mb-4">Edit User</h2>
          <div className="space-y-2">
            {/* User form fields */}
            <label className="block">
              First Name
              <input
                value={formData.first_name || ''}
                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                className="border p-1 w-full"
              />
            </label>
            <label className="block">
              Last Name
              <input
                value={formData.last_name || ''}
                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                className="border p-1 w-full"
              />
            </label>
            <label className="block">
              Email
              <input
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="border p-1 w-full"
                type="email"
              />
            </label>
            <label className="block">
              Phone
              <input
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="border p-1 w-full"
              />
            </label>
            <label className="block">
              Role
              <select
                value={formData.role || ''}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="border p-1 w-full"
              >
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => setEditUser(null)}
              className="px-4 py-2 bg-gray-200"
            >Cancel</button>
            <button
              onClick={() => updateMutation.mutate({ id: editUser!.id, data: formData })}
              disabled={updateMutation.status === 'pending'}
              className="px-4 py-2 bg-blue-600 text-white"
            >Save</button>
          </div>
        </Modal>
      )}
    </PageLayout>
  );
};

export default UsersList;
