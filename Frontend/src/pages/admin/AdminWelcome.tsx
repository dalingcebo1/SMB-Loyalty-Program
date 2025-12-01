import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HiUsers, HiUserAdd, HiCog, HiOfficeBuilding, HiChartBar, HiShieldCheck, HiClipboardList, HiBell, HiClock, HiLockClosed } from 'react-icons/hi';
import api from '../../api/api';
import { useAuth } from '../../auth/AuthProvider';
import { formatCurrency as formatCurrencyZAR } from '../../utils/format';
import { AdminPageContainer, AdminSection, AdminGrid } from '../../features/admin/components/AdminGrid';
import { StatCard, ActionCard } from '../../features/admin/components/AdminCard';

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
    return formatCurrencyZAR(value);
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

  const quickActions = [
    {
      category: 'Business Operations',
      items: [
        { to: '/admin/customers', icon: HiUsers, title: 'Customer Management', description: 'View & manage customer data' },
        { to: '/admin/reports', icon: HiChartBar, title: 'Business Reports', description: 'Analytics & insights' },
        { to: '/admin/notifications', icon: HiBell, title: 'Notifications', description: 'Send & manage notifications' },
      ]
    },
    {
      category: 'People Management',
      items: [
        { to: '/admin/users-admin', icon: HiUsers, title: 'Manage Users', description: 'View & manage user accounts' },
        { to: '/admin/users-admin?registerStaff=1', icon: HiUserAdd, title: 'Register Staff', description: 'Invite staff & assign roles' },
      ]
    },
    {
      category: 'Business Configuration',
      items: [
        { to: '/admin/branding', icon: HiOfficeBuilding, title: 'Branding', description: 'Logos, colors & brand identity' },
        { to: '/admin/modules', icon: HiCog, title: 'Modules', description: 'Feature toggles & settings' },
        { to: '/admin/inventory', icon: HiClipboardList, title: 'Inventory', description: 'Manage services & extras' },
      ]
    },
    {
      category: 'Operations & Insights',
      items: [
        { to: '/admin/staff/analytics', icon: HiChartBar, title: 'Analytics', description: 'Business insights & reports' },
        { to: '/admin/audit', icon: HiShieldCheck, title: 'Audit Logs', description: 'System activity & security' },
        { to: '/admin/jobs', icon: HiClock, title: 'Jobs Monitor', description: 'Background job queue status' },
        { to: '/admin/rate-limits', icon: HiLockClosed, title: 'Rate Limits', description: 'API throttling & IP bans' },
      ]
    }
  ];

  return (
    <AdminPageContainer
      title={`Welcome back, ${user?.firstName || 'Admin'}`}
      description="Quick overview and shortcuts to manage your platform"
    >

      {/* Quick Actions by Category */}
      {quickActions.map(({ category, items }) => (
        <AdminSection key={category} title={category}>
          <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3, xl: 3 }} gap="base">
            {items.map(({ to, icon: Icon, title, description }) => (
              <Link key={to} to={to}>
                <ActionCard
                  title={title}
                  description={description}
                  icon={<Icon className="w-5 h-5" />}
                  onClick={() => {}}
                  variant="primary"
                />
              </Link>
            ))}
          </AdminGrid>
        </AdminSection>
      ))}

      {/* System Overview Stats */}
      <AdminSection
        title="System Overview"
        description={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
      >
        {hasMetricsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Couldn't load metrics. Please refresh.
          </div>
        ) : (
          <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3, xl: 3 }} gap="base">
            <StatCard
              label="Active Customers"
              value={isLoadingMetrics ? '…' : formatNumber(activeCustomers)}
              change={!isLoadingMetrics && newCustomersDelta ? newCustomersDelta.text : undefined}
              changeDirection={
                newCustomersDelta && newCustomerChange
                  ? newCustomerChange >= 0
                    ? 'positive'
                    : 'negative'
                  : 'neutral'
              }
              info="Last 7 days"
            />
            <StatCard
              label="Completed Orders"
              value={isLoadingMetrics ? '…' : formatNumber(totalCompletedOrders)}
              change={!isLoadingMetrics && ordersDelta ? ordersDelta.text : undefined}
              changeDirection={
                ordersDelta && ordersChange ? (ordersChange >= 0 ? 'positive' : 'negative') : 'neutral'
              }
              info="Last 7 days"
            />
            <StatCard
              label="Revenue"
              value={isLoadingMetrics ? '…' : formatCurrency(revenueCurrent)}
              change={!isLoadingMetrics && revenueDelta ? revenueDelta.text : undefined}
              changeDirection={
                revenueDelta && revenueChange ? (revenueChange >= 0 ? 'positive' : 'negative') : 'neutral'
              }
              info={
                !isLoadingMetrics && pendingOrders !== null
                  ? `Pending >10m: ${formatNumber(pendingOrders)}`
                  : 'Last 7 days'
              }
            />
          </AdminGrid>
        )}
      </AdminSection>
    </AdminPageContainer>
  );
};

export default AdminWelcome;
