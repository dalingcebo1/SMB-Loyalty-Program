import React, { InputHTMLAttributes, forwardRef, useState } from 'react';
import { FaEye, FaEyeSlash, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';
import './Input.css';

export type InputSize = 'sm' | 'base' | 'lg';
export type InputStatus = 'default' | 'error' | 'success' | 'warning';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  size?: InputSize;
  status?: InputStatus;
  helperText?: string;
  errorText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isFullWidth?: boolean;
}

/**
 * Modern Input Component
 * 
 * Features:
 * - Multiple sizes with proper touch targets
 * - Status indicators (error, success, warning)
 * - Password visibility toggle
 * - Icon support (left and right)
 * - Helper and error text
 * - Full ARIA attributes for accessibility
 * - Label with required indicator
 * 
 * @example
 * <Input
 *   label="Email Address"
 *   type="email"
 *   status="error"
 *   errorText="Please enter a valid email"
 *   required
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      size = 'base',
      status = 'default',
      helperText,
      errorText,
      leftIcon,
      rightIcon,
      isFullWidth = true,
      type = 'text',
      required,
      disabled,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const isPassword = type === 'password';
    const actualType = isPassword && showPassword ? 'text' : type;
    const displayStatus = errorText ? 'error' : status;

    const inputClassName = [
      'input',
      `input--${size}`,
      `input--${displayStatus}`,
      leftIcon && 'input--has-left-icon',
      (rightIcon || isPassword) && 'input--has-right-icon',
      isFullWidth && 'input--full-width',
      disabled && 'input--disabled',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={`input-wrapper ${isFullWidth ? 'input-wrapper--full-width' : ''}`}>
        {label && (
          <label htmlFor={inputId} className="input-label">
            {label}
            {required && <span className="input-required" aria-label="required">*</span>}
          </label>
        )}
        
        <div className="input-container">
          {leftIcon && (
            <span className="input-icon input-icon--left" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            className={inputClassName}
            disabled={disabled}
            required={required}
            aria-required={required}
            aria-invalid={displayStatus === 'error'}
            aria-describedby={
              errorText
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            {...props}
          />
          
          {isPassword && (
            <button
              type="button"
              className="input-icon input-icon--right input-toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          )}
          
          {!isPassword && rightIcon && (
            <span className="input-icon input-icon--right" aria-hidden="true">
              {rightIcon}
            </span>
          )}
          
          {!isPassword && !rightIcon && displayStatus === 'error' && (
            <span className="input-icon input-icon--right input-status-icon" aria-hidden="true">
              <FaExclamationCircle />
            </span>
          )}
          
          {!isPassword && !rightIcon && displayStatus === 'success' && (
            <span className="input-icon input-icon--right input-status-icon" aria-hidden="true">
              <FaCheckCircle />
            </span>
          )}
        </div>
        
        {errorText && (
          <p id={`${inputId}-error`} className="input-message input-message--error" role="alert">
            {errorText}
          </p>
        )}
        
        {!errorText && helperText && (
          <p id={`${inputId}-helper`} className="input-message input-message--helper">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
