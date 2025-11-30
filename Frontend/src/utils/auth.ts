// Centralized authentication utilities
import api from '../api/api';

/**
 * Safely clear authentication state and navigate to login.
 * This is the single source of truth for logout behavior across the app.
 * 
 * @param navigate - Optional React Router navigate function for SPA navigation
 * @param reason - Optional reason for logout (for debugging/analytics)
 */
export function logoutAndNavigateToLogin(
  navigate?: (path: string, options?: { replace?: boolean }) => void,
  reason?: string
): void {
  if (reason) {
    console.log('[Auth] Logging out:', reason);
  }

  // 1. Clear token from storage
  localStorage.removeItem('token');
  localStorage.removeItem('cachedRole');

  // 2. Clear authorization header from axios instance
  delete api.defaults.headers.common['Authorization'];

  // 3. Navigate to login using React Router if available (SPA navigation)
  if (navigate) {
    navigate('/login', { replace: true });
    return;
  }

  // 4. Fallback: Use History API for SPA-style navigation (avoids full reload)
  if (typeof window !== 'undefined') {
    // Try to use router first via history manipulation
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));

    // If we're still not on /login after a brief delay, force a full navigation
    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }, 100);
  }
}

/**
 * Check if user appears to be authenticated (has token)
 * Note: This doesn't validate the token, just checks existence
 */
export function hasAuthToken(): boolean {
  return !!localStorage.getItem('token');
}

/**
 * Get the current auth token if it exists
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('token');
}
