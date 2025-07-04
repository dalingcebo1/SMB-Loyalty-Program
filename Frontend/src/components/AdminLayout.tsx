// src/components/AdminLayout.tsx
import React from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const AdminLayout: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow p-6">
        <h2 className="text-xl font-bold mb-4">Admin Panel</h2>
        <nav className="flex flex-col space-y-2">
          <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'font-bold' : ''}>
            Users
          </NavLink>
          <NavLink to="/admin/register-staff" className={({ isActive }) => isActive ? 'font-bold' : ''}>
            Register Staff
          </NavLink>
          <NavLink to="/admin/modules" className={({ isActive }) => isActive ? 'font-bold' : ''}>
            Modules
          </NavLink>
        </nav>
      </aside>
      {/* Main content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
