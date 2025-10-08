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

function safeGetStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (err) {
    console.warn('[modules] localStorage unavailable, falling back to ENV flags', err);
    return null;
  }
}

export function getModuleFlags(): ModuleFlags {
  const storage = safeGetStorage();
  if (!storage) return ENV_FLAGS;
  const stored = storage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return { ...ENV_FLAGS, ...JSON.parse(stored) };
    } catch (err) {
      console.warn('[modules] failed to parse stored module flags, resetting', err);
      return ENV_FLAGS;
    }
  }
  return ENV_FLAGS;
}

export function setModuleFlags(flags: Partial<ModuleFlags>): void {
  const storage = safeGetStorage();
  if (!storage) return;
  const current = getModuleFlags();
  const updated = { ...current, ...flags };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[modules] failed to persist module flags', err);
  }
}

export const moduleFlags = getModuleFlags();
