import React from 'react';
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
}) => {
  const body = (
    <div className="auth-card__body">
      <header className="auth-header">
        {eyebrow && <span className="auth-eyebrow">{eyebrow}</span>}
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      </header>
      {error && (
        <div className="auth-alert auth-alert--error" role={alertRole}>
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
