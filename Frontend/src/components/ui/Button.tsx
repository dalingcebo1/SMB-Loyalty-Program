import React, { ButtonHTMLAttributes, forwardRef, useCallback } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { motion, MotionProps } from 'framer-motion';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'base' | 'lg' | 'xl';

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MotionProps>;

export interface ButtonProps extends ButtonStyleProps, NativeButtonProps {}

const composeClassName = ({
  variant,
  size,
  isFullWidth,
  isLoading,
  className,
}: Pick<ButtonStyleProps, 'variant' | 'size' | 'isFullWidth' | 'isLoading' | 'className'>) =>
  [
    'btn',
    `btn--${variant ?? 'primary'}`,
    `btn--${size ?? 'base'}`,
    isFullWidth && 'btn--full-width',
    isLoading && 'btn--loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

const renderContent = ({
  isLoading,
  leftIcon,
  rightIcon,
  children,
}: Pick<ButtonStyleProps, 'isLoading' | 'leftIcon' | 'rightIcon' | 'children'>) => (
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
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const classNames = composeClassName({ variant, size, isFullWidth, isLoading, className });

    return (
      <motion.button
        ref={ref}
        className={classNames}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        transition={{ duration: 0.15 }}
        {...rest}
      >
        {renderContent({ isLoading, leftIcon, rightIcon, children })}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

type RouterLinkProps = Omit<LinkProps, 'className' | 'ref'>;

export interface ButtonLinkProps extends RouterLinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isFullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  tabIndex?: number;
  children: React.ReactNode;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      variant = 'primary',
      size = 'base',
      isLoading = false,
      isFullWidth = false,
      leftIcon,
      rightIcon,
      disabled = false,
      className,
      children,
      onClick,
      tabIndex,
      ...linkProps
    },
    ref
  ) => {
    const classNames = composeClassName({ variant, size, isFullWidth, isLoading, className });
    const handleClick = useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
      (event) => {
        if (disabled || isLoading) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      },
      [disabled, isLoading, onClick]
    );

    return (
      <Link
        ref={ref}
        className={classNames}
        aria-disabled={disabled || isLoading ? true : undefined}
        tabIndex={disabled || isLoading ? -1 : tabIndex}
        onClick={handleClick}
        {...linkProps}
      >
        {renderContent({ isLoading, leftIcon, rightIcon, children })}
      </Link>
    );
  }
);

ButtonLink.displayName = 'ButtonLink';
