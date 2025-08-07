// src/components/AdminLayout.tsx
import React from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const AdminLayout: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div>Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow p-6 max-h-screen overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Admin Panel</h2>
        <nav className="flex flex-col space-y-2">
          <NavLink
            to="/admin"
            className={({ isActive }) => isActive ? 'font-bold text-blue-700' : 'hover:underline'}
          >
            Home
          </NavLink>
          <hr className="my-2 border-gray-200" />
          <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'font-bold' : 'hover:underline'}>
            Users
          </NavLink>
          <hr className="my-2 border-gray-200" />
          <NavLink to="/admin/register-staff" className={({ isActive }) => isActive ? 'font-bold' : 'hover:underline'}>
            Register Staff
          </NavLink>
          <hr className="my-2 border-gray-200" />
          <NavLink to="/admin/modules" className={({ isActive }) => isActive ? 'font-bold' : 'hover:underline'}>
            Modules
          </NavLink>
          <hr className="my-2 border-gray-200" />
          <NavLink to="/admin/analytics" className={({ isActive }) => isActive ? 'font-bold' : 'hover:underline'}>
            Analytics
          </NavLink>
        </nav>
        <hr className="my-4 border-gray-200" />
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 mt-4"
        >
          Logout
        </button>
      </aside>
      {/* Main content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
