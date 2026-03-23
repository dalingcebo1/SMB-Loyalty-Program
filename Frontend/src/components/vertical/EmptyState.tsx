import React from 'react';

export interface EmptyStateProps {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * A friendly "no items" placeholder with an optional call-to-action.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No items found',
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg">
      {icon && <div className="flex justify-center mb-3 text-gray-400 text-3xl">{icon}</div>}
      <p className="text-gray-600 mb-4">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
