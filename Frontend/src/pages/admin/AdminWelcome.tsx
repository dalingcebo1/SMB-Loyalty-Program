import React, { useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HiUsers, HiUserAdd, HiCog, HiOfficeBuilding, HiChartBar, HiShieldCheck, HiClipboardList, HiBell, HiClock, HiLockClosed, HiSparkles, HiCalendar, HiColorSwatch, HiShoppingCart } from 'react-icons/hi';
import api from '../../api/api';
import { useAuth } from '../../auth/AuthProvider';
import { TenantConfigContext } from '../../config/TenantConfigProvider';
import { formatCurrency as formatCurrencyZAR } from '../../utils/format';
import { AdminPageContainer, AdminSection, AdminGrid } from '../../features/admin/components/AdminGrid';
import { StatCard, ActionCard } from '../../features/admin/components/AdminCard';
import '../../features/admin/styles/admin-modern.css';

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
  const tenantConfig = useContext(TenantConfigContext);

  // Check if onboarding is completed; redirect to wizard if not
  const { data: tenantData, isLoading: tenantLoading } = useQuery<{ onboarding_completed?: boolean }>({
    queryKey: ['admin-welcome', 'tenant-onboarding', user?.tenant_id],
    enabled: !!user?.tenant_id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get(`/tenants/${user!.tenant_id}`);
      return data as { onboarding_completed?: boolean };
    },
  });

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

  // Redirect to onboarding wizard if setup is not complete
  if (!tenantLoading && tenantData && tenantData.onboarding_completed === false) {
    return <Navigate to="/admin/onboarding" replace />;
  }

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
      tone: value >= 0 ? 'bg-emerald-50  text-emerald-600  border border-emerald-100 ' : 'bg-rose-50  text-rose-600  border border-rose-100 ',
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

  // Calculate urgent items that need attention
  const urgentItems = [];
  if (!isLoadingMetrics && pendingOrders && pendingOrders > 0) {
    urgentItems.push({
      type: 'warning',
      message: `${pendingOrders} order${pendingOrders > 1 ? 's' : ''} pending over 10 minutes`,
      action: 'View Orders',
      to: '/staff/dashboard'
    });
  }

  // Build vertical-specific quick action cards based on selected vertical
  const vertical = tenantConfig?.vertical;
  const verticalCards: Array<{ to: string; title: string; description: string; icon: React.ReactNode }> = [];

  if (vertical === 'carwash') {
    verticalCards.push(
      { to: '/admin/staff/dashboard', title: 'Staff Dashboard', description: 'Manage washes', icon: <HiUsers className="w-4 h-4" /> },
      { to: '/admin/staff/vehicle-manager', title: 'Vehicles', description: 'Manage vehicles', icon: <HiClipboardList className="w-4 h-4" /> },
    );
  } else if (vertical === 'beauty') {
    verticalCards.push(
      { to: '/admin/beauty/services', title: 'Beauty Services', description: 'Manage treatments', icon: <HiSparkles className="w-4 h-4" /> },
      { to: '/admin/beauty/stylists', title: 'Stylists', description: 'Manage team', icon: <HiUsers className="w-4 h-4" /> },
      { to: '/admin/beauty/appointments', title: 'Appointments', description: 'View calendar', icon: <HiCalendar className="w-4 h-4" /> },
    );
  } else if (vertical === 'padel') {
    verticalCards.push(
      { to: '/admin/padel/courts', title: 'Courts', description: 'Court management', icon: <HiColorSwatch className="w-4 h-4" /> },
      { to: '/admin/padel/bookings', title: 'Bookings', description: 'View schedule', icon: <HiCalendar className="w-4 h-4" /> },
    );
  } else if (vertical === 'flowershop') {
    verticalCards.push(
      { to: '/admin/inventory', title: 'Product Catalog', description: 'Manage products', icon: <HiShoppingCart className="w-4 h-4" /> },
    );
  } else if (vertical === 'dispensary') {
    verticalCards.push(
      { to: '/admin/dispensary/products', title: 'Products', description: 'Product management', icon: <HiShoppingCart className="w-4 h-4" /> },
      { to: '/admin/dispensary/categories', title: 'Categories', description: 'Organize catalog', icon: <HiClipboardList className="w-4 h-4" /> },
      { to: '/admin/dispensary/verifications', title: 'Verifications', description: 'Compliance checks', icon: <HiShieldCheck className="w-4 h-4" /> },
    );
  } else if (vertical === 'retail') {
    verticalCards.push(
      { to: '/admin/retail/inventory', title: 'Retail Inventory', description: 'Stock management', icon: <HiClipboardList className="w-4 h-4" /> },
      { to: '/admin/retail/pos', title: 'POS Terminal', description: 'Point of sale', icon: <HiShoppingCart className="w-4 h-4" /> },
      { to: '/admin/retail/sales', title: 'Sales Reports', description: 'Revenue insights', icon: <HiChartBar className="w-4 h-4" /> },
    );
  }

  return (
    <AdminPageContainer
      title={`Welcome back, ${user?.firstName || 'Admin'}`}
      description="Your business at a glance"
    >

      {/* 1. CRITICAL: Alerts & Urgent Items First */}
      {urgentItems.length > 0 && (
        <div className="admin-alert admin-alert-warning">
          <div className="flex items-start gap-3">
            <div className="admin-icon-wrapper admin-icon-wrapper-md">
              <HiClock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-900  text-sm mb-1">Needs Attention</h3>
              {urgentItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 mt-2">
                  <p className="text-amber-800  text-xs">{item.message}</p>
                  <Link 
                    to={item.to}
                    className="admin-link text-xs font-medium whitespace-nowrap"
                  >
                    {item.action} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. PRIORITY: Key Business Metrics */}
      <AdminSection title="Today's Performance">
        {hasMetricsError ? (
          <div className="admin-alert admin-alert-error">
            <p className="text-sm">Couldn't load metrics. Please refresh.</p>
          </div>
        ) : (
          <AdminGrid cols={{ mobile: 2, tablet: 3, desktop: 4, xl: 4 }} gap="sm">
            <StatCard
              label="Revenue (7d)"
              value={isLoadingMetrics ? '…' : formatCurrency(revenueCurrent)}
              change={!isLoadingMetrics && revenueDelta ? revenueDelta.text : undefined}
              changeDirection={
                revenueDelta && revenueChange ? (revenueChange >= 0 ? 'positive' : 'negative') : 'neutral'
              }
            />
            <StatCard
              label="Orders (7d)"
              value={isLoadingMetrics ? '…' : formatNumber(totalCompletedOrders)}
              change={!isLoadingMetrics && ordersDelta ? ordersDelta.text : undefined}
              changeDirection={
                ordersDelta && ordersChange ? (ordersChange >= 0 ? 'positive' : 'negative') : 'neutral'
              }
            />
            <StatCard
              label="Customers (7d)"
              value={isLoadingMetrics ? '…' : formatNumber(activeCustomers)}
              change={!isLoadingMetrics && newCustomersDelta ? newCustomersDelta.text : undefined}
              changeDirection={
                newCustomersDelta && newCustomerChange
                  ? newCustomerChange >= 0
                    ? 'positive'
                    : 'negative'
                  : 'neutral'
              }
            />
            <StatCard
              label="Avg Order"
              value={isLoadingMetrics ? '…' : formatCurrency(summary?.avg_order_value ?? null)}
            />
          </AdminGrid>
        )}
      </AdminSection>

      {/* 3. COMMON TASKS: Frequently Used Actions */}
      <AdminSection title="Common Tasks">
        <AdminGrid cols={{ mobile: 2, tablet: 3, desktop: 4, xl: 4 }} gap="sm">
          <Link to="/admin/customers">
            <ActionCard
              title="Customers"
              description="Manage accounts"
              icon={<HiUsers className="w-4 h-4" />}
              onClick={() => {}}
              variant="primary"
            />
          </Link>
          <Link to="/admin/users-admin">
            <ActionCard
              title="Users"
              description="Staff & access"
              icon={<HiUserAdd className="w-4 h-4" />}
              onClick={() => {}}
              variant="primary"
            />
          </Link>
          <Link to="/admin/reports">
            <ActionCard
              title="Reports"
              description="View analytics"
              icon={<HiChartBar className="w-4 h-4" />}
              onClick={() => {}}
              variant="primary"
            />
          </Link>
          <Link to="/admin/inventory">
            <ActionCard
              title="Inventory"
              description="Services & pricing"
              icon={<HiClipboardList className="w-4 h-4" />}
              onClick={() => {}}
              variant="primary"
            />
          </Link>
        </AdminGrid>
      </AdminSection>

      {/* 3b. VERTICAL: Show relevant cards based on selected business vertical */}
      {verticalCards.length > 0 && (
        <AdminSection title={`${vertical ? vertical.charAt(0).toUpperCase() + vertical.slice(1) : 'Your Business'} Tools`}>
          <AdminGrid cols={{ mobile: 2, tablet: 3, desktop: 4, xl: 4 }} gap="sm">
            {verticalCards.map((card) => (
              <Link key={card.to} to={card.to}>
                <ActionCard
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  onClick={() => {}}
                  variant="primary"
                />
              </Link>
            ))}
          </AdminGrid>
        </AdminSection>
      )}

      {/* 4. SETTINGS: Less Frequent Configuration */}
      <AdminSection title="Settings & Configuration">
        <AdminGrid cols={{ mobile: 2, tablet: 3, desktop: 4, xl: 4 }} gap="sm">
          <Link to="/admin/branding">
            <ActionCard
              title="Branding"
              description="Logos & colors"
              icon={<HiOfficeBuilding className="w-4 h-4" />}
              onClick={() => {}}
              variant="default"
            />
          </Link>
          <Link to="/admin/modules">
            <ActionCard
              title="Modules"
              description="Feature toggles"
              icon={<HiCog className="w-4 h-4" />}
              onClick={() => {}}
              variant="default"
            />
          </Link>
          <Link to="/admin/notifications">
            <ActionCard
              title="Notifications"
              description="Send messages"
              icon={<HiBell className="w-4 h-4" />}
              onClick={() => {}}
              variant="default"
            />
          </Link>
          <Link to="/admin/audit">
            <ActionCard
              title="Audit Logs"
              description="Security & activity"
              icon={<HiShieldCheck className="w-4 h-4" />}
              onClick={() => {}}
              variant="default"
            />
          </Link>
        </AdminGrid>
      </AdminSection>

      {/* 5. SYSTEM: Advanced/Technical Features */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between p-3 bg-gray-50  rounded-lg hover:bg-gray-100  transition-colors">
            <span className="text-sm font-semibold text-gray-700 ">Advanced Tools</span>
            <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </div>
        </summary>
        <div className="mt-3">
          <AdminGrid cols={{ mobile: 2, tablet: 3, desktop: 4, xl: 4 }} gap="sm">
            <Link to="/admin/staff/analytics">
              <ActionCard
                title="Analytics"
                description="Deep insights"
                icon={<HiChartBar className="w-4 h-4" />}
                onClick={() => {}}
                variant="default"
              />
            </Link>
            <Link to="/admin/jobs">
              <ActionCard
                title="Jobs Monitor"
                description="Background tasks"
                icon={<HiClock className="w-4 h-4" />}
                onClick={() => {}}
                variant="default"
              />
            </Link>
            <Link to="/admin/rate-limits">
              <ActionCard
                title="Rate Limits"
                description="API throttling"
                icon={<HiLockClosed className="w-4 h-4" />}
                onClick={() => {}}
                variant="default"
              />
            </Link>
          </AdminGrid>
        </div>
      </details>

      {/* Footer: Last Updated */}
      {lastUpdated && (
        <div className="text-center pt-4 border-t border-gray-100 ">
          <p className="text-xs text-gray-400">
            Last updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
      )}
    </AdminPageContainer>
  );
};

export default AdminWelcome;
