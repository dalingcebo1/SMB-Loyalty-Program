// src/types/admin.ts

/**
 * Simple date-range type for analytics hooks
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Core admin user model
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'developer';
  createdAt: string;
}

/**
 * Core tenant model
 */
export interface Tenant {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

/**
 * Settings for a feature/module flag
 */
export interface ModuleSettings {
  featureFlag: string;
  enabled: boolean;
}
