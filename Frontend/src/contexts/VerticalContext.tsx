/**
 * Vertical Context
 * 
 * Provides vertical configuration throughout the React application.
 * Automatically loads vertical config based on the current tenant.
 */

import { createContext, useContext, ReactNode } from 'react';
import {
  VerticalConfig,
  VerticalLabels,
  VerticalFeatureFlags,
  VerticalNavItem,
  getVerticalConfig,
  hasVerticalFeature as checkVerticalFeature,
  getVerticalLabels as fetchVerticalLabels,
  getVerticalNavItems as fetchVerticalNavItems,
} from '../config/verticalConfig';
import { useTenant } from '../config/TenantConfigProvider';

interface VerticalContextValue {
  config: VerticalConfig;
  labels: VerticalLabels;
  features: VerticalFeatureFlags;
  navItems: VerticalNavItem[];
  hasFeature: (feature: keyof VerticalFeatureFlags) => boolean;
  verticalKey: string;
}

const VerticalContext = createContext<VerticalContextValue | undefined>(undefined);

interface VerticalProviderProps {
  children: ReactNode;
  /** Override vertical key (for testing/preview) */
  verticalOverride?: string;
}

/**
 * Vertical Provider Component
 * 
 * Wraps the app and provides vertical configuration based on tenant settings.
 * Uses tenant context to determine which vertical configuration to load.
 */
export function VerticalProvider({ children, verticalOverride }: VerticalProviderProps) {
  const tenant = useTenant();
  
  // Determine vertical key: override > tenant vertical > default to carwash
  const verticalKey = verticalOverride || tenant?.vertical || 'carwash';
  
  // Load vertical configuration
  const config = getVerticalConfig(verticalKey);
  const labels = fetchVerticalLabels(verticalKey);
  const navItems = fetchVerticalNavItems(verticalKey);
  const features = config.features;
  
  // Helper to check if vertical has a feature
  const hasFeature = (feature: keyof VerticalFeatureFlags): boolean => {
    return checkVerticalFeature(verticalKey, feature);
  };
  
  const value: VerticalContextValue = {
    config,
    labels,
    features,
    navItems,
    hasFeature,
    verticalKey,
  };
  
  return (
    <VerticalContext.Provider value={value}>
      {children}
    </VerticalContext.Provider>
  );
}

/**
 * Hook to access vertical configuration
 * 
 * @example
 * ```tsx
 * const vertical = useVertical();
 * return <h1>{vertical.config.displayName}</h1>;
 * ```
 */
export function useVertical(): VerticalContextValue {
  const context = useContext(VerticalContext);
  
  if (context === undefined) {
    throw new Error('useVertical must be used within a VerticalProvider');
  }
  
  return context;
}

/**
 * Hook to get vertical-specific labels
 * 
 * @example
 * ```tsx
 * const labels = useVerticalLabels();
 * return <button>Create {labels.service}</button>;
 * ```
 */
export function useVerticalLabels(): VerticalLabels {
  const { labels } = useVertical();
  return labels;
}

/**
 * Hook to check vertical features
 * 
 * @example
 * ```tsx
 * const { hasFeature } = useVerticalFeatures();
 * if (hasFeature('appointments')) {
 *   return <AppointmentCalendar />;
 * }
 * ```
 */
export function useVerticalFeatures() {
  const { features, hasFeature } = useVertical();
  return { features, hasFeature };
}

/**
 * Hook to get vertical navigation items
 * 
 * @example
 * ```tsx
 * const navItems = useVerticalNavItems();
 * return navItems.map(item => <NavLink to={item.path}>{item.label}</NavLink>);
 * ```
 */
export function useVerticalNavItems(): VerticalNavItem[] {
  const { navItems } = useVertical();
  return navItems;
}
