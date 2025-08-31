// features.ts - central registry of known feature flags
// These flags can be stored under tenant.config.features (boolean values)
// Extend this list as new platform capabilities are introduced.

export interface FeatureDefinition {
  key: string;
  label: string;
  description?: string;
  default?: boolean;
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: 'enableLoyalty',
    label: 'Loyalty Module',
    description: 'Enable loyalty (rewards, redemptions, points tracking).',
    default: true,
  },
  {
    key: 'enableOrders',
    label: 'Orders / Booking',
    description: 'Enable core ordering / booking flows.',
    default: true,
  },
  {
    key: 'enablePayments',
    label: 'Payments',
    description: 'Allow payment initiation and status tracking.',
    default: true,
  },
  {
    key: 'enableUsers',
    label: 'User Accounts',
    description: 'Account management, profile, vehicles, etc.',
    default: true,
  },
];

export function applyFeatureDefaults(features: Record<string, unknown> | undefined | null) {
  const result: Record<string, boolean> = {};
  for (const def of FEATURE_DEFINITIONS) {
    const v = features && typeof features[def.key] !== 'undefined' ? Boolean(features[def.key]) : (def.default ?? false);
    result[def.key] = v;
  }
  return result;
}
