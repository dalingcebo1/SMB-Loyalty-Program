import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HiUsers, HiUserAdd, HiCog, HiOfficeBuilding, HiChartBar, HiShieldCheck, HiClipboardList, HiBell, HiClock, HiLockClosed } from 'react-icons/hi';
import api from '../../api/api';
import { useAuth } from '../../auth/AuthProvider';

interface BusinessSummaryResponse {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  active_customers: number;
  avg_order_value: number;
  loyalty_points_issued: number;
  loyalty_points_redeemed: number;
  top_service: {
    name: string;
    count: number;
  } | null;
}

interface BusinessAnalyticsSummary {
  active_customers: number;
  pending_orders_over_10m: number;
  wash_volume_trend: { day: string; started: number; completed: number }[];
  payment_mix: { manual_started: number; paid_started: number };
  deltas?: {
    revenue_pct?: number | null;
  };
  meta?: { generated_at?: string };
}

/**
 * AdminWelcome - modern admin dashboard with grouped quick actions and status overview
 */
const AdminWelcome: React.FC = () => {
  const { user } = useAuth();

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery<BusinessSummaryResponse>({
    queryKey: ['admin-welcome', 'summary', '7d'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get('/reports/summary', { params: { days: 7 } });
      return data as BusinessSummaryResponse;
    },
  });

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useQuery<BusinessAnalyticsSummary>({
    queryKey: ['admin-welcome', 'analytics', 7],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get('/payments/business-analytics', {
        params: { range_days: 7, recent_days: 7 },
      });
      return data as BusinessAnalyticsSummary;
    },
  });

  const isLoadingMetrics = summaryLoading || analyticsLoading;
  const hasMetricsError = summaryError || analyticsError;

  const formatNumber = (value?: number | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '—';
    }
    return value.toLocaleString();
  };

  const formatCurrency = (value?: number | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return '—';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const buildDeltaBadge = (value?: number | null) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return null;
    }
    return {
      text: `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
      tone: value >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100',
    };
  };

  const activeCustomers = summary?.active_customers ?? analytics?.active_customers ?? null;
  const totalCompletedOrders =
    analytics?.wash_volume_trend?.reduce(
      (sum: number, day: BusinessAnalyticsSummary['wash_volume_trend'][number]) => sum + (day.completed ?? 0),
      0,
    ) ?? null;
  const revenueChange = null;
  const revenueCurrent = summary?.total_revenue ?? null;
  const pendingOrders = analytics?.pending_orders_over_10m ?? null;
  const lastUpdated = analytics?.meta?.generated_at ? new Date(analytics.meta.generated_at) : null;
  const ordersChange = null;
  const newCustomerChange = null;
  const newCustomersDelta = buildDeltaBadge(newCustomerChange);
  const ordersDelta = buildDeltaBadge(ordersChange);
  const revenueDelta = buildDeltaBadge(revenueChange);

  // Helper function for color classes to ensure Tailwind includes them
  const getColorClasses = (color: string, type: 'bg' | 'text') => {
    const colorMap = {
      blue: type === 'bg' ? 'bg-gradient-to-br from-blue-100 to-blue-200 group-hover:from-blue-200 group-hover:to-blue-300' : 'text-blue-600',
      green: type === 'bg' ? 'bg-gradient-to-br from-green-100 to-green-200 group-hover:from-green-200 group-hover:to-green-300' : 'text-green-600',
      pink: type === 'bg' ? 'bg-gradient-to-br from-pink-100 to-pink-200 group-hover:from-pink-200 group-hover:to-pink-300' : 'text-pink-600',
      purple: type === 'bg' ? 'bg-gradient-to-br from-purple-100 to-purple-200 group-hover:from-purple-200 group-hover:to-purple-300' : 'text-purple-600',
      orange: type === 'bg' ? 'bg-gradient-to-br from-orange-100 to-orange-200 group-hover:from-orange-200 group-hover:to-orange-300' : 'text-orange-600',
      yellow: type === 'bg' ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 group-hover:from-yellow-200 group-hover:to-yellow-300' : 'text-yellow-600',
      teal: type === 'bg' ? 'bg-gradient-to-br from-teal-100 to-teal-200 group-hover:from-teal-200 group-hover:to-teal-300' : 'text-teal-600',
      indigo: type === 'bg' ? 'bg-gradient-to-br from-indigo-100 to-indigo-200 group-hover:from-indigo-200 group-hover:to-indigo-300' : 'text-indigo-600',
      red: type === 'bg' ? 'bg-gradient-to-br from-red-100 to-red-200 group-hover:from-red-200 group-hover:to-red-300' : 'text-red-600',
    };
    return colorMap[color as keyof typeof colorMap] || (type === 'bg' ? 'bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-gray-200 group-hover:to-gray-300' : 'text-gray-600');
  };

  const quickActions = [
    {
      category: 'Business Operations',
      items: [
        { to: '/admin/customers', icon: HiUsers, title: 'Customer Management', description: 'View & manage customer data', color: 'blue' },
        { to: '/admin/reports', icon: HiChartBar, title: 'Business Reports', description: 'Analytics & insights', color: 'indigo' },
        { to: '/admin/notifications', icon: HiBell, title: 'Notifications', description: 'Send & manage notifications', color: 'yellow' },
      ]
    },
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
        { to: '/admin/jobs', icon: HiClock, title: 'Jobs Monitor', description: 'Background job queue status', color: 'orange' },
        { to: '/admin/rate-limits', icon: HiLockClosed, title: 'Rate Limits', description: 'API throttling & IP bans', color: 'purple' },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Modern Compact Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white rounded-xl p-5 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">Welcome back, {user?.firstName || 'Admin'}</h1>
              <p className="text-blue-100 text-sm">Quick overview and shortcuts to manage your platform</p>
            </div>
            <div className="hidden md:block">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <HiOfficeBuilding className="w-6 h-6 text-white/80" />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
        <div className="absolute -bottom-2 -left-2 w-10 h-10 bg-white/5 rounded-full"></div>
      </div>

      {/* Quick Actions by Category */}
      {quickActions.map(({ category, items }) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="h-px bg-gradient-to-r from-gray-300 to-transparent flex-1"></div>
            <h2 className="text-lg font-bold text-gray-800 px-3 py-1.5 bg-white rounded-full shadow-sm border">
              {category}
            </h2>
            <div className="h-px bg-gradient-to-l from-gray-300 to-transparent flex-1"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(({ to, icon: Icon, title, description, color }) => (
              <Link
                key={to}
                to={to}
                className="group relative bg-white rounded-xl p-4 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start space-x-3">
                  <div className={`p-3 rounded-lg transition-all duration-300 group-hover:scale-105 ${getColorClasses(color, 'bg')}`}>
                    <Icon className={`w-5 h-5 ${getColorClasses(color, 'text')}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 group-hover:text-gray-800 mb-0.5">{title}</h3>
                    <p className="text-xs text-gray-600">{description}</p>
                  </div>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </Link>
            ))}
            </div>
          </div>
        ))}

      {/* Compact Quick Stats */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">System Overview</h2>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <div
              className={`w-2 h-2 rounded-full ${pendingOrders && pendingOrders > 0 ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}
            ></div>
            <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}</span>
          </div>
        </div>
        {hasMetricsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Couldn't load metrics. Please refresh.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative text-center p-4 rounded-lg border border-gray-200 group-hover:border-blue-300 transition-colors duration-300">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {isLoadingMetrics ? '…' : formatNumber(activeCustomers)}
                </div>
                <div className="text-sm font-semibold text-gray-600">Active Customers</div>
                <div className="text-xs text-gray-500 mt-0.5">Last 7 days</div>
                {!isLoadingMetrics && newCustomersDelta ? (
                  <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${newCustomersDelta.tone}`}>
                    {newCustomersDelta.text}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-green-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative text-center p-4 rounded-lg border border-gray-200 group-hover:border-green-300 transition-colors duration-300">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {isLoadingMetrics ? '…' : formatNumber(totalCompletedOrders)}
                </div>
                <div className="text-sm font-semibold text-gray-600">Completed Orders</div>
                <div className="text-xs text-gray-500 mt-0.5">Last 7 days</div>
                {!isLoadingMetrics && ordersDelta ? (
                  <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ordersDelta.tone}`}>
                    {ordersDelta.text}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative text-center p-4 rounded-lg border border-gray-200 group-hover:border-emerald-300 transition-colors duration-300">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {isLoadingMetrics ? '…' : formatCurrency(revenueCurrent)}
                </div>
                <div className="text-sm font-semibold text-gray-600">Revenue</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {!isLoadingMetrics && revenueDelta ? `${revenueDelta.text}` : 'Last 7 days'}
                </div>
                {!isLoadingMetrics && pendingOrders !== null ? (
                  <div className="mt-2 text-xs font-semibold text-gray-600">
                    Pending &gt;10m: {' '}
                    <span className={pendingOrders > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                      {formatNumber(pendingOrders)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWelcome;
