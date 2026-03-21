import React from 'react';
import { useInstallPrompt } from './useInstallPrompt';

/**
 * Custom "Add to Home Screen" banner shown to returning customers.
 *
 * Renders only when:
 * - The browser supports installation (`beforeinstallprompt` fired)
 * - The user has visited at least 2 times
 * - The user hasn't previously dismissed the banner
 */
export const InstallPromptBanner: React.FC = () => {
  const { canPrompt, promptInstall, dismiss } = useInstallPrompt();

  if (!canPrompt) return null;

  return (
    <div
      role="banner"
      aria-label="Install app"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 2rem)',
        maxWidth: 420,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        zIndex: 9999,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <span style={{ fontSize: '2rem' }} aria-hidden="true">📲</span>
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Install our app</strong>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Add to your home screen for quick access &amp; offline support.
        </span>
      </div>
      <button
        onClick={promptInstall}
        aria-label="Install"
        style={{
          padding: '0.5rem 1rem',
          background: 'var(--color-primary, #667eea)',
          color: '#fff',
          border: 'none',
          borderRadius: '0.5rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        style={{
          background: 'none',
          border: 'none',
          fontSize: '1.25rem',
          cursor: 'pointer',
          color: '#94a3b8',
          padding: '0.25rem',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
};

export default InstallPromptBanner;
