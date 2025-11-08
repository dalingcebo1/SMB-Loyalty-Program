import React from 'react';
import { FieldError } from 'react-hook-form';
import '../styles/auth-shared.css';

interface AuthFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  helper?: string;
  error?: string | FieldError | undefined;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  after?: React.ReactNode; // trailing actions (e.g., show/hide, forgot password link)
}

/**
 * AuthField
 * Standardized field block (label, input, helper, error).
 * Accepts react-hook-form register spread via inputProps.
 * Migration pattern:
 * 1. Replace <div className="auth-field"> block with <AuthField id label ... />.
 * 2. Pass register spread inside inputProps along with autoComplete/data-cy.
 * 3. Provide after prop for trailing buttons (e.g., show/hide password).
 * 4. Move helper text into helper prop, error string into error prop.
 */
const AuthField: React.FC<AuthFieldProps> = ({
  id,
  label,
  type = 'text',
  placeholder,
  helper,
  error,
  inputProps,
  after,
}) => {
  const errMsg = typeof error === 'string' ? error : error?.message;
  const describedBy = errMsg ? `error-${id}` : helper ? `help-${id}` : undefined;
  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">{label}</label>
      <div className={after ? 'auth-input-wrapper' : undefined}>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          className="auth-input"
          aria-invalid={Boolean(errMsg)}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {after}
      </div>
      {helper && !errMsg && (
        <p id={`help-${id}`} className="auth-helper">{helper}</p>
      )}
      {errMsg && (
        <p id={`error-${id}`} className="auth-error-msg" role="alert">{errMsg}</p>
      )}
    </div>
  );
};

export default AuthField;
