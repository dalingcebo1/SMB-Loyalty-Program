import React, { HTMLAttributes } from 'react';
import './Badge.css';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'base' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  dot?: boolean;
}

/**
 * Modern Badge Component
 * 
 * Features:
 * - Multiple variants for different statuses
 * - Three sizes
 * - Optional status dot
 * - Accessible with proper contrast
 * 
 * @example
 * <Badge variant="success">Active</Badge>
 * <Badge variant="error" dot>Offline</Badge>
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'base',
  children,
  dot = false,
  className = '',
  ...props
}) => {
  const combinedClassName = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    dot && 'badge--with-dot',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={combinedClassName} {...props}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      <span className="badge-label">{children}</span>
    </span>
  );
};

export default Badge;
