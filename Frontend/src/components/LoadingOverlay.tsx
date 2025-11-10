import React from 'react';

interface LoadingOverlayProps {
  message?: string;
  inline?: boolean;
  role?: 'status' | 'alert' | 'progressbar';
}

/** Reusable loading overlay (screen-centered or inline) */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Loading...', inline = false, role = 'status' }) => {
  return inline ? (
    <div className="loading" role={role} aria-live="polite">
      <div className="loading-spinner" />
      <p>{message}</p>
    </div>
  ) : (
    <div className="loading-overlay" role={role} aria-live="polite">
      <div className="loading">
        <div className="loading-spinner" />
        <p>{message}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;