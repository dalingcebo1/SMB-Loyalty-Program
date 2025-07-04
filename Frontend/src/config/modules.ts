// src/config/modules.ts
// Feature flags to enable/disable modules at runtime
// src/config/modules.ts
// Provides feature flags with persistence in localStorage for plug-and-play modules
export interface ModuleFlags {
  enableCatalog: boolean;
  enableLoyalty: boolean;
  enableOrders: boolean;
  enablePayments: boolean;
  enableUsers: boolean;
}

const ENV_FLAGS: ModuleFlags = {
  enableCatalog: import.meta.env.VITE_ENABLE_CATALOG === 'true',
  enableLoyalty: import.meta.env.VITE_ENABLE_LOYALTY === 'true',
  enableOrders: import.meta.env.VITE_ENABLE_ORDERS === 'true',
  enablePayments: import.meta.env.VITE_ENABLE_PAYMENTS === 'true',
  enableUsers: import.meta.env.VITE_ENABLE_USERS === 'true',
};

const STORAGE_KEY = 'moduleFlags';

export function getModuleFlags(): ModuleFlags {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return { ...ENV_FLAGS, ...JSON.parse(stored) }; } catch {};
  }
  return ENV_FLAGS;
}

export function setModuleFlags(flags: Partial<ModuleFlags>): void {
  const current = getModuleFlags();
  const updated = { ...current, ...flags };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export const moduleFlags = getModuleFlags();
