// Centralized staff navigation configuration & helpers
// Phase: Staff logic improvement - unify spread definitions & allow future dynamic feature flags

import { ROLE_CAPABILITIES } from '../../admin/config/capabilities';

export interface StaffNavItem {
  path: string;
  label: string;
  icon: string; // emojis or icon identifiers
  description: string;
  roles?: Array<'staff' | 'admin'>; // permitted roles (default: all staff/admin)
  featureFlag?: string; // optional module flag key
  requiredCaps?: string[];
  anyCaps?: string[];
}

export const staffNavItems: StaffNavItem[] = [
  {
    path: '/staff/dashboard',
    label: 'Dashboard',
    icon: 'analytics',
    description: 'Overview & active washes',
    requiredCaps: ['orders.view'],
  },
  {
    path: '/staff/vehicle-manager',
    label: 'Vehicles',
    icon: 'car',
    description: 'Vehicle management',
    requiredCaps: ['vehicles.view'],
  },
  {
    path: '/staff/wash-history',
    label: 'History',
    icon: 'wash',
    description: 'Wash history & tracking',
    requiredCaps: ['orders.view'],
  },
  {
    path: '/staff/payment',
    label: 'Payments',
    icon: 'revenue',
    description: 'Payment verification',
    requiredCaps: ['payments.verify'],
  },
  {
    path: '/staff/analytics',
    label: 'Analytics',
    icon: 'performance',
    description: 'Business analytics & reports',
    requiredCaps: ['loyalty.view'],
  },
  {
    path: '/staff/customer-analytics',
    label: 'Customers',
    icon: 'user',
    description: 'Top & loyalty analytics',
    requiredCaps: ['loyalty.view'],
  },
  {
    path: '/staff/manual-visit',
    label: 'Manual log',
    icon: 'inProgress',
    description: 'Manual visit logger',
    requiredCaps: ['orders.create'],
  },
];

type StaffRole = 'staff' | 'admin';

function hasCapability(capabilities: string[], cap: string | undefined): boolean {
  if (!cap) return true;
  if (capabilities.includes('*')) return true;
  return capabilities.includes(cap);
}

function meetsAll(capabilities: string[], required: string[] | undefined): boolean {
  if (!required || required.length === 0) return true;
  return required.every((cap) => hasCapability(capabilities, cap));
}

function meetsAny(capabilities: string[], anyCaps: string[] | undefined): boolean {
  if (!anyCaps || anyCaps.length === 0) return true;
  return anyCaps.some((cap) => hasCapability(capabilities, cap));
}

export function filterStaffNav(role: string | undefined, currentPath: string, capabilitiesOverride?: string[]): StaffNavItem[] {
  const capabilities = capabilitiesOverride ?? (role ? (ROLE_CAPABILITIES[role] || []) : []);
  return staffNavItems.filter(item => {
    if (item.roles) {
      const r = role as StaffRole | undefined;
      if (!r || !item.roles.includes(r)) return false;
    }
    if (!meetsAll(capabilities, item.requiredCaps)) return false;
    if (!meetsAny(capabilities, item.anyCaps)) return false;
    // Hide dashboard tile when already on dashboard
    if (currentPath === '/staff/dashboard' && item.path === '/staff/dashboard') return false;
    return true;
  });
}
