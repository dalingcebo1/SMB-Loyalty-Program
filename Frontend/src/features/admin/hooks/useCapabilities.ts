import { useAuth, User } from '../../../auth/AuthProvider';
import { hasCapability, ROLE_CAPABILITIES } from '../config/capabilities';

export interface CapabilityHook {
  role: string | undefined;
  capabilities: string[];
  has: (cap: string) => boolean;
}

export function useCapabilities(): CapabilityHook {
  const { user } = useAuth();
  const role: string | undefined = (user as User | null)?.role;
  const list = role ? (ROLE_CAPABILITIES[role] || []) : [];
  return { role, capabilities: list, has: (cap: string) => hasCapability(role, cap) };
}
