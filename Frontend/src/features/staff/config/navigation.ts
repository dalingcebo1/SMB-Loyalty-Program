// Centralized staff navigation configuration & helpers
// Phase: Staff logic improvement - unify spread definitions & allow future dynamic feature flags

export interface StaffNavItem {
  path: string;
  label: string;
  icon: string; // emojis or icon identifiers
  description: string;
  roles?: Array<'staff' | 'admin'>; // permitted roles (default: all staff/admin)
  featureFlag?: string; // optional module flag key
}

export const staffNavItems: StaffNavItem[] = [
  { path: '/staff/dashboard', label: 'Dashboard', icon: 'analytics', description: 'Overview & Active Washes' },
  { path: '/staff/vehicle-manager', label: 'Vehicles', icon: 'car', description: 'Vehicle Management' },
  { path: '/staff/wash-history', label: 'History', icon: 'wash', description: 'Wash History & Tracking' },
  { path: '/staff/payment', label: 'Payments', icon: 'revenue', description: 'Payment Verification' },
  { path: '/staff/analytics', label: 'Analytics', icon: 'performance', description: 'Business Analytics & Reports' },
  { path: '/staff/customer-analytics', label: 'Customers', icon: 'user', description: 'Top & Loyalty Analytics' },
  { path: '/staff/manual-visit', label: 'Manual Log', icon: 'inProgress', description: 'Manual Visit Logger' },
];

type StaffRole = 'staff' | 'admin';
export function filterStaffNav(role: string | undefined, currentPath: string): StaffNavItem[] {
  return staffNavItems.filter(item => {
    if (item.roles) {
      const r = role as StaffRole | undefined;
      if (!r || !item.roles.includes(r)) return false;
    }
    // Hide dashboard tile when already on dashboard
    if (currentPath === '/staff/dashboard' && item.path === '/staff/dashboard') return false;
    return true;
  });
}
