// utils/notifications.ts
// Centralized user feedback helpers wrapping react-toastify.
// Ensures consistent styling, durations, and analytics tracking.
import { toast, ToastOptions } from 'react-toastify';
import { track } from './analytics';
import { translate } from './i18n';

const base: ToastOptions = {
  position: 'top-center',
  autoClose: 3000,
  pauseOnHover: true,
  closeOnClick: true,
  draggable: false,
  hideProgressBar: true,
};

// Deduplication map: message -> last timestamp
const lastShown: Record<string, number> = {};
const DEDUPE_INTERVAL = 2500; // ms

interface NotifyOpts extends ToastOptions {
  skipDedupe?: boolean;
}

let notificationsEnabled = true;
const PREF_KEY = 'app.notifications.enabled';
try {
  const raw = localStorage.getItem(PREF_KEY);
  if (raw === 'false') notificationsEnabled = false;
} catch { /* ignore */ }

export function setNotificationsEnabled(enabled: boolean) {
  notificationsEnabled = enabled;
  try { localStorage.setItem(PREF_KEY, String(enabled)); } catch { /* ignore */ }
}

export function getNotificationsEnabled() {
  return notificationsEnabled;
}

function merge(opts?: NotifyOpts): NotifyOpts {
  return { ...base, ...opts };
}

function shouldShow(message: string, opts?: NotifyOpts): boolean {
  if (!notificationsEnabled) return false;
  if (opts?.skipDedupe) return true;
  const now = Date.now();
  const last = lastShown[message] || 0;
  if (now - last < DEDUPE_INTERVAL) return false;
  lastShown[message] = now;
  return true;
}

export function notifySuccess(message: string, opts?: NotifyOpts) {
  if (!shouldShow(message, opts)) return;
  track('toast', { level: 'success', message });
  return toast.success(message, merge(opts));
}

export function notifyError(message: string, opts?: NotifyOpts) {
  if (!shouldShow(message, opts)) return;
  track('toast', { level: 'error', message });
  return toast.error(message, merge(opts));
}

export function notifyInfo(message: string, opts?: NotifyOpts) {
  if (!shouldShow(message, opts)) return;
  track('toast', { level: 'info', message });
  return toast.info(message, merge(opts));
}

export function notifyWarning(message: string, opts?: NotifyOpts) {
  if (!shouldShow(message, opts)) return;
  track('toast', { level: 'warning', message });
  return toast.warning(message, merge(opts));
}

// Key-based helpers using i18n
export function notifySuccessKey(key: string, params?: Record<string, unknown>, opts?: NotifyOpts) {
  return notifySuccess(translate(key, params), opts);
}
export function notifyErrorKey(key: string, params?: Record<string, unknown>, opts?: NotifyOpts) {
  return notifyError(translate(key, params), opts);
}
export function notifyInfoKey(key: string, params?: Record<string, unknown>, opts?: NotifyOpts) {
  return notifyInfo(translate(key, params), opts);
}
export function notifyWarningKey(key: string, params?: Record<string, unknown>, opts?: NotifyOpts) {
  return notifyWarning(translate(key, params), opts);
}

// Specialized helpers for common app events
export function notifyOrderConfirmed(orderId: string) {
  void orderId; // reserved for future context (tracking) - mark as used
  return notifySuccess('🎉 Order confirmed successfully!', { autoClose: 2500 });
}

export function notifyPaymentSuccess(amountCents: number) {
  void amountCents; // reserved for later display; mark as used for lint
  return notifySuccess('Payment successful!', { autoClose: 2000 });
}

export function notifyClipboard(message = 'Copied to clipboard') {
  return notifySuccess(message, { autoClose: 1500 });
}

export function notifyRedeemSuccess() {
  return notifySuccess('Wash redeemed for loyalty points!');
}

export function notifyRedeemError() {
  return notifyError('Could not redeem wash. Please try again.');
}

export function notifySdkTimeout() {
  return notifyInfo('SDK load timeout, proceeding with payment UI.');
}

export function notifyBookingConfirmed() {
  return notifySuccess('Booking confirmed! Redirecting to payment...');
}

export function notifyGenericError(detail?: string) {
  return notifyError(detail || 'An unexpected error occurred');
}

// Allow direct access if absolutely needed (legacy migration)
export const rawToast = toast;
