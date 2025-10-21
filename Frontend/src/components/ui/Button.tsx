// src/components/ui/Button.tsx
import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'base' | 'lg' | 'xl';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  as?: 'button' | 'a';
  href?: string;
  children: React.ReactNode;
}

/**
 * Modern Button Component
 * 
 * Features:
 * - Multiple variants for different contexts
 * - Responsive sizes with proper touch targets
 * - Loading states with spinner
 * - Icon support (left and right)
 * - Full ARIA attributes for accessibility
 * - Keyboard navigation support
 * - Smooth animations with Framer Motion
 * 
 * @example
 * <Button variant="primary" size="lg" leftIcon={<FaCheck />} onClick={handleSubmit}>
 *   Submit Order
 * </Button>
 */
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
      type = 'button',
      as = 'button',
      href,
      ...props
    },
    ref
  ) => {
    const combinedClassName = [
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
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
        {!isLoading && leftIcon && <span className="btn__icon btn__icon--left">{leftIcon}</span>}
        <span className="btn__label">{children}</span>
        {!isLoading && rightIcon && <span className="btn__icon btn__icon--right">{rightIcon}</span>}
      </>
    );

    const buttonProps = {
      ref,
      className: combinedClassName,
      disabled: disabled || isLoading,
      type: as === 'button' ? type : undefined,
      'aria-disabled': disabled || isLoading,
      ...props,
    };

    if (as === 'a' && href) {
      return (
        <motion.a
          {...(buttonProps as any)}
          href={href}
          whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
          whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
          transition={{ duration: 0.15 }}
        >
          {content}
        </motion.a>
      );
    }

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
    {...props}
  >
    {isLoading ? (
      <>
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading...
      </>
    ) : (
      <>
        {leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </>
    )}
  </button>
);

export default Button;
