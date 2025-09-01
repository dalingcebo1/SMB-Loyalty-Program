import React from 'react';
import { Link } from 'react-router-dom';
import { HiUsers, HiUserAdd, HiCog, HiOfficeBuilding, HiChartBar, HiShieldCheck } from 'react-icons/hi';
import { useAuth } from '../../auth/AuthProvider';

/**
 * AdminWelcome - modern admin dashboard with grouped quick actions and status overview
 */
const AdminWelcome: React.FC = () => {
  const { user } = useAuth();

  const quickActions = [
    {
      category: 'People Management',
      items: [
        { to: '/admin/users', icon: HiUsers, title: 'Manage Users', description: 'View & manage user accounts', color: 'blue' },
  { to: '/admin/users-admin?registerStaff=1', icon: HiUserAdd, title: 'Register Staff', description: 'Invite staff & assign roles', color: 'green' },
      ]
    },
    {
      category: 'My Business',
      items: [
  { to: '/admin/branding', icon: HiOfficeBuilding, title: 'Branding', description: 'Logos, colors & identity', color: 'pink' },
        { to: '/admin/tenant-settings', icon: HiOfficeBuilding, title: 'Tenant Settings', description: 'Brand & primary settings', color: 'purple' },
        { to: '/admin/modules', icon: HiCog, title: 'Modules', description: 'Feature toggles & settings', color: 'orange' },
      ]
    },
    {
      category: 'Operations',
      items: [
        { to: '/admin/staff/analytics', icon: HiChartBar, title: 'Analytics', description: 'Business insights & reports', color: 'indigo' },
        { to: '/admin/audit', icon: HiShieldCheck, title: 'Audit Logs', description: 'System activity & security', color: 'red' },
      ]
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.firstName || 'Admin'}</h1>
        <p className="text-blue-100">Manage your platform from this centralized dashboard</p>
      </div>

      {/* Quick Actions by Category */}
      {quickActions.map(({ category, items }) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(({ to, icon: Icon, title, description, color }) => (
              <Link
                key={to}
                to={to}
                className={`group p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:border-${color}-300`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 bg-${color}-100 rounded-lg group-hover:bg-${color}-200 transition-colors`}>
                    <Icon className={`w-6 h-6 text-${color}-600`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-gray-800">{title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Recent Activity Preview (placeholder for future enhancement) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">—</div>
            <div className="text-sm text-gray-600">Active Users</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">—</div>
            <div className="text-sm text-gray-600">Recent Orders</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">—</div>
            <div className="text-sm text-gray-600">System Health</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWelcome;
