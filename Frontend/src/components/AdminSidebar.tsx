import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const links = [
  { to: '/admin', label: 'Home' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/register-staff', label: 'Register Staff' },
  { to: '/admin/modules', label: 'Modules' },
  { to: '/admin/analytics', label: 'Analytics' },
];

const AdminSidebar: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="w-64 bg-white shadow p-6 max-h-screen overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Admin Panel</h2>
      <nav className="flex flex-col space-y-2">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              isActive ? 'font-bold text-blue-700' : 'hover:underline'
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <hr className="my-4 border-gray-200" />
      <button
        onClick={() => {
          logout();
          navigate('/login');
        }}
        className="w-full px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 mt-4"
      >
        Logout
      </button>
    </aside>
  );
};

export default AdminSidebar;
