// Unified grouped admin navigation configuration.
// Provides: groups, items, legacy path redirects, and flatten utilities.

import type { VerticalFeatureFlags } from '../../../config/verticalConfig';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  legacyPaths?: string[]; // optional historical paths to redirect from
  cap?: string;           // capability required
  roles?: string[];       // allowed roles fallback to admin/superadmin
  feature?: keyof import('../../../config/modules').ModuleFlags; // feature flag required
  requiredVerticalFeature?: keyof VerticalFeatureFlags; // vertical feature required
  allowedVerticals?: string[]; // only show for specific verticals
}

export interface NavGroup {
  key: string;
  title: string;
  items: NavItem[];
  roles?: string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

// Build groups dynamically so we can hide items when feature flags disable them
export const adminNavGroups: NavGroup[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    items: [
      { key: 'home', label: 'Overview', path: '/admin', cap: 'tenant.edit' },
    ],
  },
  {
    key: 'people',
    title: 'People & Access',
    items: [
      { key: 'users-admin', label: 'Users Admin', path: '/admin/users-admin', cap: 'users.role.update' },
      {
        key: 'customers-admin',
        label: 'Customers',
        path: '/admin/customers',
        cap: 'manage_customers',
        legacyPaths: ['/staff/customer-analytics']
      },
    ],
  },
  {
    key: 'tenant-config',
    title: 'My Business',
    items: [
      { key: 'organization', label: 'My Business', path: '/admin/settings', cap: 'tenant.edit' },
      { key: 'tenants', label: 'Platform Tenants', path: '/admin/tenants', cap: 'platform.manage_tenants', legacyPaths: ['/admin/tenant'] },
      { key: 'modules', label: 'Marketplace', path: '/admin/modules', cap: 'services.manage' },
      { key: 'loyalty-settings', label: 'Loyalty Settings', path: '/admin/loyalty-settings', cap: 'services.manage' },
      { key: 'inventory', label: 'Inventory', path: '/admin/inventory', cap: 'services.manage', feature: 'enableCatalog' },
      { key: 'subscription', label: 'Subscription', path: '/admin/subscription', cap: 'tenant.edit', feature: 'enableSubscription' },
    ],
  },
  {
    key: 'payments',
    title: 'Payments & Billing',
    items: [
      { key: 'transactions', label: 'Transactions', path: '/admin/transactions', cap: 'payments.view', feature: 'enablePayments' },
      { key: 'billing', label: 'Billing & Usage', path: '/admin/billing', cap: 'tenant.edit' },
    ],
  },
  {
    key: 'staff-ops',
    title: 'Staff Operations',
    items: [
      { key: 'staff-dashboard', label: 'Dashboard', path: '/admin/staff/dashboard', cap: 'tenant.edit', legacyPaths: ['/staff/dashboard'] },
      { 
        key: 'vehicles', 
        label: 'Vehicles', 
        path: '/admin/staff/vehicle-manager', 
        cap: 'tenant.edit', 
        legacyPaths: ['/staff/vehicle-manager'],
        requiredVerticalFeature: 'vehicleTracking' // Only for carwash
      },
      { 
        key: 'wash-history', 
        label: 'Wash History', 
        path: '/admin/staff/wash-history', 
        cap: 'tenant.edit', 
        legacyPaths: ['/staff/wash-history'],
        allowedVerticals: ['carwash'] // Carwash-specific
      },
      { key: 'payments', label: 'Payments', path: '/admin/staff/payment', cap: 'tenant.edit', legacyPaths: ['/staff/payment'] },
      { key: 'analytics', label: 'Analytics', path: '/admin/staff/analytics', cap: 'tenant.edit', legacyPaths: ['/staff/analytics'] },
      { key: 'customers', label: 'Customers', path: '/admin/staff/customer-analytics', cap: 'tenant.edit', legacyPaths: ['/staff/customer-analytics'] },
      { key: 'manual-visit', label: 'Manual Log', path: '/admin/staff/manual-visit', cap: 'tenant.edit', legacyPaths: ['/staff/manual-visit'] },
    ],
  },
  {
    key: 'insights',
    title: 'Insights & History',
    items: [
      { key: 'reports', label: 'Reports', path: '/admin/reports', cap: 'view_reports' },
      { key: 'analytics', label: 'Advanced Analytics', path: '/admin/analytics', cap: 'view_reports' },
      { key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit', cap: 'audit.view' },
      { key: 'jobs', label: 'Jobs', path: '/admin/jobs', cap: 'jobs.view' },
      { key: 'rate-limits', label: 'Rate Limits', path: '/admin/rate-limits', cap: 'rate_limit.edit' },
    ],
  },
  {
    key: 'communications',
    title: 'Customer Engagement',
    items: [
      { key: 'notifications', label: 'Notifications', path: '/admin/notifications', cap: 'manage_notifications' },
    ],
  },
  {
    key: 'verticals',
    title: 'Vertical Operations',
    items: [
      // Retail
      { key: 'retail-inventory', label: 'Retail Inventory', path: '/admin/retail/inventory', cap: 'services.manage', allowedVerticals: ['retail'] },
      { key: 'retail-pos', label: 'POS Terminal', path: '/admin/retail/pos', cap: 'services.manage', allowedVerticals: ['retail'] },
      // Dispensary
      { key: 'dispensary-products', label: 'Products', path: '/admin/dispensary/products', cap: 'services.manage', allowedVerticals: ['dispensary'] },
      { key: 'dispensary-categories', label: 'Categories', path: '/admin/dispensary/categories', cap: 'services.manage', allowedVerticals: ['dispensary'] },
      { key: 'dispensary-verifications', label: 'Verifications', path: '/admin/dispensary/verifications', cap: 'services.manage', allowedVerticals: ['dispensary'] },
      { key: 'dispensary-sales', label: 'Sales Reports', path: '/admin/dispensary/sales', cap: 'view_reports', allowedVerticals: ['dispensary'] },
      // Padel
      { key: 'padel-courts', label: 'Court Management', path: '/admin/padel/courts', cap: 'services.manage', allowedVerticals: ['padel'] },
      { key: 'padel-bookings', label: 'Bookings', path: '/admin/padel/bookings', cap: 'services.manage', allowedVerticals: ['padel'] },
      // Beauty
      { key: 'beauty-services', label: 'Services', path: '/admin/beauty/services', cap: 'services.manage', allowedVerticals: ['beauty'] },
      { key: 'beauty-stylists', label: 'Stylists', path: '/admin/beauty/stylists', cap: 'services.manage', allowedVerticals: ['beauty'] },
      { key: 'beauty-appointments', label: 'Appointments', path: '/admin/beauty/appointments', cap: 'services.manage', allowedVerticals: ['beauty'] },
    ],
  },
];

export const allAdminNavItems: NavItem[] = adminNavGroups.flatMap(g => g.items);
