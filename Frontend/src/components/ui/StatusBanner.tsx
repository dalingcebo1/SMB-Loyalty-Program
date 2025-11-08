import React from 'react';
import { UserCard } from '../user';

export type StatusBannerVariant = 'info' | 'success' | 'warning' | 'error';

interface StatusBannerProps {
  variant: StatusBannerVariant;
  title: string;
  description?: string | React.ReactNode;
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  ariaLive?: 'polite' | 'assertive';
  role?: 'alert' | 'status';
  className?: string;
  children?: React.ReactNode;
}

// Maps error variant to existing warning style until a dedicated error style is added.
const mapVariantClass = (v: StatusBannerVariant) => {
  if (v === 'error') return 'warning'; // fallback style
  return v;
};

export const StatusBanner: React.FC<StatusBannerProps> = ({
  variant,
  title,
  description,
  icon,
  dismissible = false,
  onDismiss,
  ariaLive = 'polite',
  role = 'status',
  className = '',
  children,
}) => {
  const variantClass = mapVariantClass(variant);
  return (
    <UserCard
      className={`status-banner status-banner--${variantClass} ${className}`.trim()}
      muted
      role={role}
      aria-live={ariaLive}
    >
      {icon && (
        <span className="status-banner__icon" aria-hidden="true">{icon}</span>
      )}
      <div className="status-banner__content">
        <h3 className="status-banner__title">{title}</h3>
        {description && (
          <p className="status-banner__description">{description}</p>
        )}
        {children}
      </div>
      {dismissible && (
        <button
          type="button"
          className="status-banner__dismiss btn--ghost"
          aria-label="Dismiss message"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </UserCard>
  );
};

export default StatusBanner;