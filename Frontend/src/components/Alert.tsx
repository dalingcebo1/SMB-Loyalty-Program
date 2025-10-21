import React from 'react';
import { classNames } from '../utils/classNames';
import { Button } from './ui/Button';

interface AlertProps {
  type?: 'error' | 'info' | 'success';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ type = 'info', message, actionLabel, onAction, onClose }) => {
  const baseClasses = ['border-l-4', 'p-4', 'mb-4', 'flex', 'items-center', 'justify-between'];
  let textClasses = 'text-sm';

  // Add variant styles
  const variantStyles = {
    error: {
      container: ['bg-red-100', 'border-red-500'],
      text: ['text-red-700'],
      buttonVariant: 'danger' as const,
    },
    success: {
      container: ['bg-green-100', 'border-green-500'],
      text: ['text-green-700'],
      buttonVariant: 'primary' as const,
    },
    info: {
      container: ['bg-blue-100', 'border-blue-500'],
      text: ['text-blue-700'],
      buttonVariant: 'secondary' as const,
    },
  };
  const vs = variantStyles[type];
  const containerClasses = classNames(...baseClasses, ...vs.container);
  textClasses = classNames(textClasses, ...vs.text);

  return (
    <div className={containerClasses}>
      <div className={textClasses}>{message}</div>
      <div className="flex items-center">
        {actionLabel && onAction && (
          <Button variant={vs.buttonVariant} onClick={onAction} className="ml-4">
            {actionLabel}
          </Button>
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
