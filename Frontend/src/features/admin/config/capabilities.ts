// Central capability map. Server should also enforce; this is client convenience.
// Roles -> capabilities list used for conditional rendering / routing.
export const ROLE_CAPABILITIES: Record<string, string[]> = {
  user: [
    'loyalty.view',
    'orders.create',
    'orders.view_own'
  ],
  staff: [
    'loyalty.view','orders.create','orders.view','orders.manage_active',
    'payments.verify','payments.view','vehicles.view','vehicles.update'
  ],
  admin: [
    'loyalty.view','orders.create','orders.view','orders.manage_active','payments.verify','payments.view','vehicles.view','vehicles.update',
    // Admin-only extras:
    'tenant.edit','services.manage','pricing.update','users.invite','users.role.update','analytics.advanced',
    'audit.view','jobs.view','jobs.retry','rate_limit.edit','security.ip_ban','rewards.adjust','exports.generate','config.version.view'
  ],
  developer: [
    'dev.tools','jobs.view','jobs.retry','audit.view','rate_limit.edit'
  ],
  superadmin: [
    '*'
  ]
};

export function hasCapability(role: string | undefined, cap: string): boolean {
  if (!role) return false;
  const caps = ROLE_CAPABILITIES[role] || [];
  if (caps.includes('*')) return true;
  return caps.includes(cap);
}
