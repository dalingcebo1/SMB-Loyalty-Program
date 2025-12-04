/**
 * AdminCard - Reusable card component for admin pages
 * Uses design tokens for consistent styling and responsive behavior
 */

import type { ReactNode } from 'react';
import '../styles/admin-modern.css';

interface AdminCardProps {
  /** Card title */
  title?: string;
  /** Card description or subtitle */
  description?: string;
  /** Card content */
  children: ReactNode;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** Icon to display (e.g., lucide-react icon component) */
  icon?: ReactNode;
  /** Visual variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  /** Show hover effect */
  hoverable?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Padding size */
  padding?: 'sm' | 'base' | 'lg';
}

const variantStyles = {
  default: {
    card: 'bg-white border-gray-200',
    iconBg: 'bg-gray-50',
    iconColor: 'text-gray-500',
  },
  primary: {
    card: 'bg-white border-blue-100',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  success: {
    card: 'bg-white border-green-200',
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
    iconColor: 'text-white',
  },
  warning: {
    card: 'bg-white border-yellow-200',
    iconBg: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
    iconColor: 'text-white',
  },
  error: {
    card: 'bg-white border-red-200',
    iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
    iconColor: 'text-white',
  },
};

const paddingSizes = {
  sm: 'p-4',
  base: 'p-6',
  lg: 'p-8',
};

export function AdminCard({
  title,
  description,
  children,
  onClick,
  icon,
  variant = 'default',
  hoverable = true,
  className = '',
  padding = 'base',
}: AdminCardProps) {
  const styles = variantStyles[variant];
  const isInteractive = !!onClick && hoverable;

  return (
    <div
      onClick={onClick}
      className={`
        admin-card
        ${variant === 'primary' ? 'admin-card-primary' : ''}
        ${isInteractive ? 'admin-card-interactive' : ''}
        ${styles.card}
        ${paddingSizes[padding]}
        ${className}
      `}
    >
      {/* Header with icon and title */}
      {(icon || title || description) && (
        <div className="flex items-start gap-3 mb-3">
          {icon && (
            <div
              className={`
                admin-icon-wrapper admin-icon-wrapper-md
                ${styles.iconBg}
                ${styles.iconColor}
                flex-shrink-0
              `}
            >
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h3
                className="font-semibold text-gray-900  mb-0.5"
                style={{
                  fontSize: 'var(--font-size-base)',
                  lineHeight: 'var(--line-height-snug)',
                }}
              >
                {title}
              </h3>
            )}
            {description && (
              <p
                className="text-gray-600 "
                style={{
                  fontSize: 'var(--font-size-xs)',
                  lineHeight: 'var(--line-height-normal)',
                }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}

/** Stat Card - Specialized card for displaying metrics */
interface StatCardProps {
  /** Stat label */
  label: string;
  /** Stat value */
  value: string | number;
  /** Optional change indicator (e.g., "+12%") */
  change?: string;
  /** Change direction for color coding */
  changeDirection?: 'positive' | 'negative' | 'neutral';
  /** Optional icon */
  icon?: ReactNode;
  /** Additional info text */
  info?: string;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeDirection = 'neutral',
  icon,
  info,
  onClick,
  className = '',
}: StatCardProps) {
  const changeBadgeClass = {
    positive: 'admin-badge admin-badge-green stat-trend-positive',
    negative: 'admin-badge admin-badge-red stat-trend-negative',
    neutral: 'admin-badge admin-badge-gray',
  };

  return (
    <AdminCard
      onClick={onClick}
      hoverable={!!onClick}
      icon={icon}
      className={`stat-card ${className}`}
      padding="base"
    >
      <div className="space-y-1">
        <p
          className="text-gray-500  font-medium"
          style={{
            fontSize: '0.75rem',
          }}
        >
          {label}
        </p>
        <p
          className="text-gray-900  font-bold stat-value"
          style={{
            fontSize: 'var(--font-size-xl)',
            lineHeight: 'var(--line-height-tight)',
          }}
        >
          {value}
        </p>
        {(change || info) && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {change && (
              <span className={changeBadgeClass[changeDirection]}>
                {change}
              </span>
            )}
            {info && (
              <span
                className="text-gray-500"
                style={{
                  fontSize: '0.6875rem',
                }}
              >
                {info}
              </span>
            )}
          </div>
        )}
      </div>
    </AdminCard>
  );
}

/** Action Card - Card with primary action button styling */
interface ActionCardProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Icon */
  icon: ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Visual variant */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  /** Optional badge text */
  badge?: string;
  /** Additional CSS classes */
  className?: string;
}

export function ActionCard({
  title,
  description,
  icon,
  onClick,
  variant = 'primary',
  badge,
  className = '',
}: ActionCardProps) {
  const badgeClass = {
    primary: 'admin-badge admin-badge-blue',
    success: 'admin-badge admin-badge-green',
    warning: 'admin-badge admin-badge-amber',
    error: 'admin-badge admin-badge-red',
    default: 'admin-badge admin-badge-gray',
  };

  return (
    <AdminCard
      onClick={onClick}
      variant={variant}
      hoverable={true}
      icon={icon}
      className={`action-card group ${className}`}
      padding="sm"
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3
            className="font-semibold text-gray-900  group-hover:text-primary-600  transition-colors"
            style={{
              fontSize: 'var(--font-size-sm)',
              lineHeight: 'var(--line-height-snug)',
            }}
          >
            {title}
          </h3>
          {badge && (
            <span className={badgeClass[variant]}>
              {badge}
            </span>
          )}
        </div>
        <p
          className="text-gray-600 "
          style={{
            fontSize: '0.8125rem',
            lineHeight: '1.4',
          }}
        >
          {description}
        </p>
      </div>
    </AdminCard>
  );
}
