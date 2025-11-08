import React, { useEffect, useRef } from 'react';
import '../styles/auth-shared.css';

interface AuthLayoutProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  error?: string | null;
  errorAction?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  alertRole?: 'alert' | 'status';
  noCard?: boolean; // Render inner body without card wrapper (for complex multi-step flows)
  containerClassName?: string; // allow custom outer container classes
  mainRole?: 'main' | 'region'; // allow overriding landmark role for page body
}

/**
 * AuthLayout
 * Reusable wrapper for public auth pages providing consistent card layout,
 * header (eyebrow, title, subtitle) and optional error banner.
 * Keeps existing CSS classes to avoid regression. No behavior changes.
 * Migration pattern:
 * 1. Remove outer <div className="auth-page">...</div> markup from page file.
 * 2. Wrap page form/content with <AuthLayout eyebrow title subtitle ...>.
 * 3. Move existing error block into error/errorAction props.
 * 4. Supply footer JSX via footer prop.
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({
  eyebrow,
  title,
  subtitle,
  error,
  errorAction,
  children,
  footer,
  alertRole = 'alert',
  noCard = false,
  containerClassName,
  mainRole = 'main',
}) => {
  const errorRef = useRef<HTMLDivElement | null>(null);
  // Focus the error banner when a new error appears for better screen reader context
  useEffect(() => {
    if (error && errorRef.current) {
      // Defer focus to next tick to ensure rendering complete
      setTimeout(() => {
        errorRef.current?.focus();
      }, 0);
    }
  }, [error]);

  const body = (
    <div className="auth-card__body" role={mainRole}>
      <header className="auth-header">
        {eyebrow && <span className="auth-eyebrow">{eyebrow}</span>}
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      </header>
      {error && (
        <div
          className="auth-alert auth-alert--error"
          role={alertRole}
          aria-live={alertRole === 'alert' ? 'assertive' : 'polite'}
          id="auth-error-banner"
          tabIndex={-1}
          ref={errorRef}
        >
          <div>{error}</div>
          {errorAction}
        </div>
      )}
      {children}
      {footer && <footer className="auth-footer" aria-live="polite">{footer}</footer>}
    </div>
  );
  return (
    <div className={containerClassName ? containerClassName : 'auth-page'}>
      {noCard ? body : (
        <div className="auth-card">
          {body}
        </div>
      )}
    </div>
  );
};

export default AuthLayout;
