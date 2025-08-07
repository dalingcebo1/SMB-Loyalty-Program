// src/pages/admin/UsersList.tsx
import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../../api/api';
import Pagination from '../../components/Pagination';
import PageLayout from '../../components/PageLayout';
import { useAuth } from '../../auth/AuthProvider';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

const UsersList: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  // filter and paginate users
  const filtered = users.filter(u =>
    u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get<User[]>('/users');
        setUsers(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (authLoading) return <PageLayout loading>{null}</PageLayout>;
  if (!user || user.role !== 'admin') return <Navigate to='/' replace />;

  if (loading) return <PageLayout loading loadingText="Loading users...">{null}</PageLayout>;
  if (error) return <PageLayout error={error} onRetry={() => {/* no retry */}}>{null}</PageLayout>;

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
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow rounded-lg">
            <thead>
              <tr>
                <th className="px-4 py-2 border">ID</th>
                <th className="px-4 py-2 border">Name</th>
                <th className="px-4 py-2 border">Email</th>
                <th className="px-4 py-2 border">Phone</th>
                <th className="px-4 py-2 border">Role</th>
                <th className="px-4 py-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(u => (
                <tr key={u.id} className="hover:bg-gray-100">
                  <td className="px-4 py-2 border text-center">{u.id}</td>
                  <td className="px-4 py-2 border">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-2 border">{u.email}</td>
                  <td className="px-4 py-2 border">{u.phone}</td>
                  <td className="px-4 py-2 border capitalize">{u.role}</td>
                  <td className="px-4 py-2 border">
                    <Link
                      to={`/admin/users/${u.id}/edit`}
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
