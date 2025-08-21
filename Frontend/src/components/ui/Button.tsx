// src/components/ui/Button.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary hover:bg-primary-hover text-white',
  secondary: 'bg-secondary hover:bg-secondary-hover text-gray-800',
  outline: 'border border-gray-300 hover:bg-secondary text-gray-800',
  danger: 'bg-danger hover:bg-danger-hover text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1',
  md: 'px-4 py-2',
  lg: 'text-lg px-5 py-2.5',
};

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}) => (
  <button
    role="button"
    aria-disabled={disabled || isLoading}
    className={twMerge(
      'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
      variantClasses[variant],
      sizeClasses[size],
      (disabled || isLoading) && 'opacity-60 cursor-not-allowed',
      className
    )}
    disabled={disabled || isLoading}
    {...props}
  >
    {isLoading && (
      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    )}
    {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
    {children}
    {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
  </button>
);

export default Button;
