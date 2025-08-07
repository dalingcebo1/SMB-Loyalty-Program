// src/components/ui/Button.tsx
import React from 'react';
import { classNames } from '../../utils/classNames';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200',
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', className, children, ...rest }) => (
  <button
    className={classNames(
      'px-3 py-1 rounded',
      variantClasses[variant],
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

export default Button;
