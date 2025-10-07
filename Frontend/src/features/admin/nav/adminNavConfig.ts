// Unified grouped admin navigation configuration.
// Provides: groups, items, legacy path redirects, and flatten utilities.

export interface NavItem {
  key: string;
  label: string;
  path: string;
  legacyPaths?: string[]; // optional historical paths to redirect from
  cap?: string;           // capability required
  roles?: string[];       // allowed roles fallback to admin/superadmin
}

export interface NavGroup {
  key: string;
  title: string;
  items: NavItem[];
  roles?: string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

import { moduleFlags } from '../../../config/modules';

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
    ],
  },
  {
    key: 'tenant-config',
    title: 'My Business',
    items: [
      { key: 'branding', label: 'Branding', path: '/admin/branding', cap: 'tenant.edit' },
      { key: 'modules', label: 'Modules', path: '/admin/modules', cap: 'services.manage' },
      { key: 'inventory', label: 'Inventory', path: '/admin/inventory', cap: 'services.manage' },
      ...(moduleFlags.enableSubscription ? [ { key: 'subscription', label: 'Subscription', path: '/admin/subscription', cap: 'tenant.edit' } ] : []),
    ],
  },
  {
    key: 'payments',
    title: 'Payments & Billing',
    items: [
      { key: 'transactions', label: 'Transactions', path: '/admin/transactions', cap: 'payments.view' },
    ],
  },
  {
    key: 'staff-ops',
    title: 'Staff Operations',
    items: [
      { key: 'staff-dashboard', label: 'Dashboard', path: '/admin/staff/dashboard', cap: 'tenant.edit', legacyPaths: ['/staff/dashboard'] },
      { key: 'vehicles', label: 'Vehicles', path: '/admin/staff/vehicle-manager', cap: 'tenant.edit', legacyPaths: ['/staff/vehicle-manager'] },
      { key: 'wash-history', label: 'Wash History', path: '/admin/staff/wash-history', cap: 'tenant.edit', legacyPaths: ['/staff/wash-history'] },
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
      { key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit', cap: 'audit.view' },
      { key: 'jobs', label: 'Jobs', path: '/admin/jobs', cap: 'jobs.view' },
      { key: 'rate-limits', label: 'Rate Limits', path: '/admin/rate-limits', cap: 'rate_limit.edit' },
    ],
  },
];

export const allAdminNavItems: NavItem[] = adminNavGroups.flatMap(g => g.items);
