import React from 'react';
import { Link } from 'react-router-dom';
import { HiUsers, HiUserAdd, HiCog, HiOfficeBuilding, HiChartBar, HiShieldCheck, HiClipboardList } from 'react-icons/hi';
import { useAuth } from '../../auth/AuthProvider';

/**
 * AdminWelcome - modern admin dashboard with grouped quick actions and status overview
 */
const AdminWelcome: React.FC = () => {
  const { user } = useAuth();

  // Helper function for color classes to ensure Tailwind includes them
  const getColorClasses = (color: string, type: 'bg' | 'text') => {
    const colorMap = {
      blue: type === 'bg' ? 'bg-gradient-to-br from-blue-100 to-blue-200 group-hover:from-blue-200 group-hover:to-blue-300' : 'text-blue-600',
      green: type === 'bg' ? 'bg-gradient-to-br from-green-100 to-green-200 group-hover:from-green-200 group-hover:to-green-300' : 'text-green-600',
      pink: type === 'bg' ? 'bg-gradient-to-br from-pink-100 to-pink-200 group-hover:from-pink-200 group-hover:to-pink-300' : 'text-pink-600',
      purple: type === 'bg' ? 'bg-gradient-to-br from-purple-100 to-purple-200 group-hover:from-purple-200 group-hover:to-purple-300' : 'text-purple-600',
      orange: type === 'bg' ? 'bg-gradient-to-br from-orange-100 to-orange-200 group-hover:from-orange-200 group-hover:to-orange-300' : 'text-orange-600',
      teal: type === 'bg' ? 'bg-gradient-to-br from-teal-100 to-teal-200 group-hover:from-teal-200 group-hover:to-teal-300' : 'text-teal-600',
      indigo: type === 'bg' ? 'bg-gradient-to-br from-indigo-100 to-indigo-200 group-hover:from-indigo-200 group-hover:to-indigo-300' : 'text-indigo-600',
      red: type === 'bg' ? 'bg-gradient-to-br from-red-100 to-red-200 group-hover:from-red-200 group-hover:to-red-300' : 'text-red-600',
    };
    return colorMap[color as keyof typeof colorMap] || (type === 'bg' ? 'bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-gray-200 group-hover:to-gray-300' : 'text-gray-600');
  };

  const quickActions = [
    {
      category: 'People Management',
      items: [
        { to: '/admin/users', icon: HiUsers, title: 'Manage Users', description: 'View & manage user accounts', color: 'blue' },
  { to: '/admin/users-admin?registerStaff=1', icon: HiUserAdd, title: 'Register Staff', description: 'Invite staff & assign roles', color: 'green' },
      ]
    },
    {
      category: 'Business Configuration',
      items: [
  { to: '/admin/branding', icon: HiOfficeBuilding, title: 'Branding', description: 'Logos, colors & brand identity', color: 'purple' },
        { to: '/admin/modules', icon: HiCog, title: 'Modules', description: 'Feature toggles & settings', color: 'orange' },
        { to: '/admin/inventory', icon: HiClipboardList, title: 'Inventory', description: 'Manage services & extras', color: 'teal' },
      ]
    },
    {
      category: 'Operations & Insights',
      items: [
        { to: '/admin/staff/analytics', icon: HiChartBar, title: 'Analytics', description: 'Business insights & reports', color: 'indigo' },
        { to: '/admin/audit', icon: HiShieldCheck, title: 'Audit Logs', description: 'System activity & security', color: 'red' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Enhanced Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white rounded-2xl p-8 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-3">Welcome back, {user?.firstName || 'Admin'}</h1>
                <p className="text-blue-100 text-lg">Manage your platform from this centralized dashboard</p>
              </div>
              <div className="hidden md:block">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <HiOfficeBuilding className="w-12 h-12 text-white/80" />
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full"></div>
          <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full"></div>
        </div>

        {/* Quick Actions by Category */}
        {quickActions.map(({ category, items }) => (
          <div key={category} className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="h-px bg-gradient-to-r from-gray-300 to-transparent flex-1"></div>
              <h2 className="text-xl font-bold text-gray-800 px-4 py-2 bg-white rounded-full shadow-sm border">
                {category}
              </h2>
              <div className="h-px bg-gradient-to-l from-gray-300 to-transparent flex-1"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map(({ to, icon: Icon, title, description, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="group relative bg-white rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200 hover:-translate-y-1"
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-4 rounded-xl transition-all duration-300 group-hover:scale-110 shadow-sm ${getColorClasses(color, 'bg')}`}>
                      <Icon className={`w-7 h-7 ${getColorClasses(color, 'text')}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 group-hover:text-gray-800 mb-1 text-lg">{title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Enhanced Quick Stats */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-800">System Overview</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Real-time data</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative text-center p-6 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-blue-300 transition-colors duration-300">
                <div className="text-3xl font-bold text-gray-400 mb-2">—</div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Active Users</div>
                <div className="text-xs text-gray-500">Last 24 hours</div>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-green-100 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative text-center p-6 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-green-300 transition-colors duration-300">
                <div className="text-3xl font-bold text-gray-400 mb-2">—</div>
                <div className="text-sm font-semibold text-gray-600 mb-1">Recent Orders</div>
                <div className="text-xs text-gray-500">This week</div>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative text-center p-6 rounded-xl border-2 border-dashed border-gray-200 group-hover:border-emerald-300 transition-colors duration-300">
                <div className="text-3xl font-bold text-emerald-500 mb-2">●</div>
                <div className="text-sm font-semibold text-gray-600 mb-1">System Health</div>
                <div className="text-xs text-gray-500">All systems operational</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWelcome;
