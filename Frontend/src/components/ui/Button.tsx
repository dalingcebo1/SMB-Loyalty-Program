import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, MotionProps } from 'framer-motion';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'base' | 'lg' | 'xl';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'base',
      isLoading = false,
      isFullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    const classNames = [
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      isFullWidth && 'btn--full-width',
      isLoading && 'btn--loading',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const content = (
      <>
        {isLoading && (
          <span className="btn__spinner" role="status" aria-label="Loading">
            <svg className="btn__spinner-icon" viewBox="0 0 24 24" fill="none">
              <circle
                className="btn__spinner-track"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <circle
                className="btn__spinner-fill"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="63"
                strokeDashoffset="50"
              />
            </svg>
          </span>
        )}
        {leftIcon && !isLoading && <span className="btn__icon btn__icon--left">{leftIcon}</span>}
        <span className="btn__text">{children}</span>
        {rightIcon && !isLoading && <span className="btn__icon btn__icon--right">{rightIcon}</span>}
      </>
    );

    const buttonProps = {
      ref,
      className: classNames,
      disabled: disabled || isLoading,
      'aria-busy': isLoading,
      ...rest,
    };

    return (
      <motion.button
        {...buttonProps}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        transition={{ duration: 0.15 }}
      >
        {content}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
