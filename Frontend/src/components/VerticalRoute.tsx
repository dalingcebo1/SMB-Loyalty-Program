/**
 * Vertical Route Component
 * 
 * Conditionally renders routes based on vertical feature support.
 * Use this to hide navigation items or entire routes that don't apply
 * to the current tenant's vertical.
 */

import { ReactNode } from 'react';
import { useVertical } from '../contexts/VerticalContext';
import { VerticalFeatureFlags } from '../config/verticalConfig';

interface VerticalRouteProps {
  /** Feature required for this route to be visible */
  requiredFeature?: keyof VerticalFeatureFlags;
  /** List of verticals that should see this route (if not using requiredFeature) */
  allowedVerticals?: string[];
  /** Content to render if feature is enabled */
  children: ReactNode;
  /** Optional fallback content if feature/vertical check fails */
  fallback?: ReactNode;
}

/**
 * VerticalRoute Component
 * 
 * Conditionally renders children based on vertical feature flags or vertical whitelist.
 * 
 * @example Using feature flag
 * ```tsx
 * <VerticalRoute requiredFeature="appointments">
 *   <Link to="/appointments">Calendar</Link>
 * </VerticalRoute>
 * ```
 * 
 * @example Using vertical whitelist
 * ```tsx
 * <VerticalRoute allowedVerticals={['carwash', 'beauty']}>
 *   <Link to="/vehicles">Vehicles</Link>
 * </VerticalRoute>
 * ```
 * 
 * @example With fallback
 * ```tsx
 * <VerticalRoute 
 *   requiredFeature="pos" 
 *   fallback={<div>POS not available</div>}
 * >
 *   <POSTerminal />
 * </VerticalRoute>
 * ```
 */
export function VerticalRoute({
  requiredFeature,
  allowedVerticals,
  children,
  fallback = null,
}: VerticalRouteProps): JSX.Element | null {
  const { hasFeature, verticalKey } = useVertical();
  
  // Check feature flag if provided
  if (requiredFeature) {
    const featureEnabled = hasFeature(requiredFeature);
    return featureEnabled ? <>{children}</> : <>{fallback}</>;
  }
  
  // Check vertical whitelist if provided
  if (allowedVerticals && allowedVerticals.length > 0) {
    const isAllowed = allowedVerticals.includes(verticalKey);
    return isAllowed ? <>{children}</> : <>{fallback}</>;
  }
  
  // If no conditions specified, always render
  return <>{children}</>;
}

/**
 * Hook version for inline conditional rendering
 * 
 * @example
 * ```tsx
 * const shouldShow = useVerticalRoute('appointments');
 * if (!shouldShow) return null;
 * return <AppointmentCalendar />;
 * ```
 */
export function useVerticalRoute(
  requiredFeature?: keyof VerticalFeatureFlags,
  allowedVerticals?: string[]
): boolean {
  const { hasFeature, verticalKey } = useVertical();
  
  if (requiredFeature) {
    return hasFeature(requiredFeature);
  }
  
  if (allowedVerticals && allowedVerticals.length > 0) {
    return allowedVerticals.includes(verticalKey);
  }
  
  return true;
}
