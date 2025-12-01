/**
 * AdminGrid - Responsive grid system for admin pages
 * Provides consistent breakpoint behavior and spacing
 */

import type { ReactNode } from 'react';

interface AdminGridProps {
  /** Grid children (cards, components, etc.) */
  children: ReactNode;
  /** Number of columns at different breakpoints */
  cols?: {
    /** Mobile: 1 column (default) */
    mobile?: 1 | 2;
    /** Tablet: typically 2 columns (default) */
    tablet?: 1 | 2 | 3;
    /** Desktop: typically 3 columns (default) */
    desktop?: 1 | 2 | 3 | 4;
    /** Large desktop: typically 4 columns (default) */
    xl?: 1 | 2 | 3 | 4 | 5 | 6;
  };
  /** Gap size between grid items */
  gap?: 'sm' | 'base' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
}

const gapSizes = {
  sm: 'gap-4',
  base: 'gap-6',
  lg: 'gap-8',
  xl: 'gap-10',
};

export function AdminGrid({
  children,
  cols = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
    xl: 4,
  },
  gap = 'base',
  className = '',
}: AdminGridProps) {
  const { mobile = 1, tablet = 2, desktop = 3, xl = 4 } = cols;

  const gridClass = `
    grid
    grid-cols-${mobile}
    md:grid-cols-${tablet}
    lg:grid-cols-${desktop}
    xl:grid-cols-${xl}
    ${gapSizes[gap]}
  `;

  return <div className={`${gridClass} ${className}`}>{children}</div>;
}

/** Page Container - Consistent page layout wrapper */
interface AdminPageContainerProps {
  /** Page title */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Action buttons/elements to show in header */
  actions?: ReactNode;
  /** Page content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function AdminPageContainer({
  title,
  description,
  actions,
  children,
  className = '',
}: AdminPageContainerProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1
            className="font-bold text-gray-900"
            style={{
              fontSize: 'var(--font-size-3xl)',
              lineHeight: 'var(--line-height-tight)',
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="mt-2 text-gray-600"
              style={{
                fontSize: 'var(--font-size-base)',
                lineHeight: 'var(--line-height-relaxed)',
              }}
            >
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}

/** Section - Consistent section layout within pages */
interface AdminSectionProps {
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Section content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function AdminSection({
  title,
  description,
  children,
  className = '',
}: AdminSectionProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {(title || description) && (
        <div>
          {title && (
            <h2
              className="font-semibold text-gray-900"
              style={{
                fontSize: 'var(--font-size-xl)',
                lineHeight: 'var(--line-height-snug)',
              }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              className="mt-1 text-gray-600"
              style={{
                fontSize: 'var(--font-size-sm)',
                lineHeight: 'var(--line-height-normal)',
              }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
