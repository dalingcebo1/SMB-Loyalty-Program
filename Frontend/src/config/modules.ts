// src/config/modules.ts
// Feature flags to enable/disable modules at runtime
// src/config/modules.ts
// Provides feature flags with persistence in localStorage for plug-and-play modules
export interface ModuleFlags {
  enableCatalog: boolean;
  // Catalog submodules
  catalogServices: boolean;
  catalogExtras: boolean;
  enableLoyalty: boolean;
  // Loyalty submodules
  loyaltyView: boolean;
  loyaltyRedeem: boolean;
  enableOrders: boolean;
  // Orders submodules
  ordersCreate: boolean;
  ordersHistory: boolean;
  enablePayments: boolean;
  // Payments submodules
  paymentsVerify: boolean;
  enableUsers: boolean;
  // Users submodules
  usersAccount: boolean;
  usersAdmin: boolean;
  // Subscription admin area
  enableSubscription: boolean;
  // Car Wash module
  enableCarWash: boolean;
  carWashVerify: boolean;
  carWashLogVisit: boolean;
  carWashManageVehicles: boolean;
}

const ENV_FLAGS: ModuleFlags = {
  enableCatalog: import.meta.env.VITE_ENABLE_CATALOG !== 'false',
  catalogServices: false,
  catalogExtras: false,
  enableLoyalty: import.meta.env.VITE_ENABLE_LOYALTY !== 'false',
  loyaltyView: false,
  loyaltyRedeem: false,
  enableOrders: import.meta.env.VITE_ENABLE_ORDERS !== 'false',
  ordersCreate: false,
  ordersHistory: false,
  enablePayments: import.meta.env.VITE_ENABLE_PAYMENTS !== 'false',
  paymentsVerify: false,
  enableUsers: import.meta.env.VITE_ENABLE_USERS !== 'false',
  usersAccount: false,
  usersAdmin: false,
  // Subscription flag (defaults true unless explicitly disabled)
  enableSubscription: import.meta.env.VITE_ENABLE_SUBSCRIPTION !== 'false',
  // Car Wash flags
  enableCarWash: import.meta.env.VITE_ENABLE_CAR_WASH !== 'false',
  carWashVerify: false,
  carWashLogVisit: false,
  carWashManageVehicles: false,
};

const STORAGE_KEY = 'moduleFlags';

export function getModuleFlags(): ModuleFlags {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { 
      return { ...ENV_FLAGS, ...JSON.parse(stored) }; 
    } catch {
      // Invalid JSON in localStorage, return defaults
      return ENV_FLAGS;
    }
  }
  return ENV_FLAGS;
}

export function setModuleFlags(flags: Partial<ModuleFlags>): void {
  const current = getModuleFlags();
  const updated = { ...current, ...flags };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export const moduleFlags = getModuleFlags();
