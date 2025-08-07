// src/pages/admin/UsersList.tsx
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/api';
import Pagination from '../../components/Pagination';
import PageLayout from '../../components/PageLayout';
import { useAuth } from '../../auth/AuthProvider';
// @ts-ignore: react-window types not found in this project setup
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  // fetch users via React Query
  const { data: users = [], isLoading, isError, error, refetch } = useQuery<ApiUser[], Error>({
    queryKey: ['adminUsers'],
    queryFn: () => api.get<ApiUser[]>('/users').then(res => res.data),
  });

  // filter and paginate users
  const filtered = users.filter(u =>
    u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (authLoading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to='/' replace />;

  if (isLoading) return <PageLayout loading loadingText="Loading users...">{null}</PageLayout>;
  if (isError) return <PageLayout error={error?.message || 'Failed to load users'} onRetry={() => refetch()}>{null}</PageLayout>;

  return (
    <PageLayout>
      <div>
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="border p-2 w-full max-w-xs"
          />
        </div>
        {/* Virtualized user list for performance */}
        <div className="overflow-auto border rounded-lg bg-white shadow">
          <List
            height={400}
            itemCount={paginated.length}
            itemSize={50}
            width="100%"
          >{
            // @ts-ignore: implicit any for ListChildComponentProps
            ({ index, style }: ListChildComponentProps) => {
              const u = paginated[index];
              return (
                <div
                  key={u.id}
                  style={style}
                  className="grid grid-cols-6 items-center border-b hover:bg-gray-100"
                >
                  <div className="px-4 py-2 text-center">{u.id}</div>
                  <div className="px-4 py-2">{u.first_name} {u.last_name}</div>
                  <div className="px-4 py-2">{u.email}</div>
                  <div className="px-4 py-2">{u.phone}</div>
                  <div className="px-4 py-2 capitalize">{u.role}</div>
                  <div className="px-4 py-2">
                    <Link to={`/admin/users/${u.id}/edit`} className="text-blue-600 hover:underline">Edit</Link>
                  </div>
                </div>
              );
          }}</List>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </PageLayout>
  );
};

export default UsersList;
