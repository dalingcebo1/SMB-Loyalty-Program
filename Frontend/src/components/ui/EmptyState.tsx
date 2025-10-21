import React, { HTMLAttributes } from 'react';
import './EmptyState.css';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: string;
}

/**
 * Modern Empty State Component
 * 
 * Features:
 * - Icon or illustration support
 * - Title and description
 * - Optional call-to-action button
 * - Accessible and friendly messaging
 * 
 * @example
 * <EmptyState
 *   icon={<FaInbox />}
 *   title="No orders yet"
 *   description="Start by booking your first wash"
 *   action={<Button variant="primary">Book Now</Button>}
 * />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  illustration,
  className = '',
  ...props
}) => {
  return (
    <div className={`empty-state ${className}`} {...props}>
      <div className="empty-state__content">
        {illustration && (
          <img
            src={illustration}
            alt=""
            className="empty-state__illustration"
            aria-hidden="true"
          />
        )}
        {icon && !illustration && (
          <div className="empty-state__icon" aria-hidden="true">
            {icon}
          </div>
        )}
        <h3 className="empty-state__title">{title}</h3>
        {description && <p className="empty-state__description">{description}</p>}
        {action && <div className="empty-state__action">{action}</div>}
      </div>
    </div>
  );
};

export default EmptyState;
