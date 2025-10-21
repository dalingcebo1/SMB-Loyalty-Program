import React, { HTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import './Card.css';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'ghost';
export type CardPadding = 'none' | 'sm' | 'base' | 'lg';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  variant?: CardVariant;
  padding?: CardPadding;
  isInteractive?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  as?: 'div' | 'article' | 'section';
}

/**
 * Modern Card Component
 * 
 * Features:
 * - Multiple variants for different contexts
 * - Configurable padding
 * - Interactive hover states
 * - Loading skeleton state
 * - Semantic HTML support
 * - Accessibility built-in
 * 
 * @example
 * <Card variant="elevated" isInteractive onClick={handleClick}>
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </Card>
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'base',
  isInteractive = false,
  isLoading = false,
  children,
  className = '',
  as = 'div',
  onClick,
  ...props
}) => {
  const combinedClassName = [
    'card',
    `card--${variant}`,
    `card--padding-${padding}`,
    isInteractive && 'card--interactive',
    isLoading && 'card--loading',
    onClick && 'card--clickable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const Component = as;
  const MotionComponent = motion[as as keyof typeof motion] as any;

  if (isInteractive || onClick) {
    return (
      <MotionComponent
        className={combinedClassName}
        onClick={onClick}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick(e as any);
                }
              }
            : undefined
        }
        {...props}
      >
        {isLoading ? <CardSkeleton /> : children}
      </MotionComponent>
    );
  }

  return (
    <Component className={combinedClassName} {...props}>
      {isLoading ? <CardSkeleton /> : children}
    </Component>
  );
};

/**
 * Card Header Component
 */
export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ 
  children, 
  className = '', 
  ...props 
}) => (
  <div className={`card-header ${className}`} {...props}>
    {children}
  </div>
);

/**
 * Card Body/Content Component
 */
export const CardBody: React.FC<HTMLAttributes<HTMLDivElement>> = ({ 
  children, 
  className = '', 
  ...props 
}) => (
  <div className={`card-body ${className}`} {...props}>
    {children}
  </div>
);

/**
 * Card Footer Component
 */
export const CardFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({ 
  children, 
  className = '', 
  ...props 
}) => (
  <div className={`card-footer ${className}`} {...props}>
    {children}
  </div>
);

/**
 * Card Skeleton Loading State
 */
const CardSkeleton: React.FC = () => (
  <div className="card-skeleton">
    <div className="skeleton skeleton--title" />
    <div className="skeleton skeleton--text" />
    <div className="skeleton skeleton--text" />
    <div className="skeleton skeleton--text skeleton--short" />
  </div>
);

export default Card;
