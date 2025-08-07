import React from 'react';

interface AlertProps {
  type?: 'error' | 'info' | 'success';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ type = 'info', message, actionLabel, onAction, onClose }) => {
  let containerClasses = 'border-l-4 p-4 mb-4 flex items-center justify-between';
  let textClasses = 'text-sm';
  let actionButtonClasses = 'ml-4 px-3 py-1 rounded text-white';

  switch (type) {
    case 'error':
      containerClasses += ' bg-red-100 border-red-500';
      textClasses += ' text-red-700';
      actionButtonClasses = 'ml-4 px-3 py-1 bg-red-500 rounded text-white';
      break;
    case 'success':
      containerClasses += ' bg-green-100 border-green-500';
      textClasses += ' text-green-700';
      actionButtonClasses = 'ml-4 px-3 py-1 bg-green-500 rounded text-white';
      break;
    default:
      containerClasses += ' bg-blue-100 border-blue-500';
      textClasses += ' text-blue-700';
      actionButtonClasses = 'ml-4 px-3 py-1 bg-blue-500 rounded text-white';
  }

  return (
    <div className={containerClasses}>
      <div className={textClasses}>{message}</div>
      <div className="flex items-center">
        {actionLabel && onAction && (
          <button onClick={onAction} className={actionButtonClasses}>
            {actionLabel}
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-2 text-sm text-gray-500 hover:underline">
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
