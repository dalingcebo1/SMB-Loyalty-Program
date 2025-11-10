// utils/i18n.ts - Minimal i18n scaffold
// Provides a translate(key, params) function and a dictionary for 'en'.
// Extend by adding more locales and dynamic loading later.

export type Locale = 'en';
let currentLocale: Locale = 'en';

interface DictEntry { message: string }
type Dictionary = Record<string, DictEntry>;

const en: Dictionary = {
  'notifications.profile.updated': { message: 'Profile updated successfully' },
  'notifications.vehicle.added': { message: 'Vehicle added successfully' },
  'notifications.vehicle.deleted': { message: 'Vehicle deleted successfully' },
  'notifications.plan.updated': { message: 'Plan updated' },
  'notifications.plan.created': { message: 'Plan created' },
  'notifications.plan.archived': { message: 'Plan archived' },
  'notifications.plan.restored': { message: 'Plan restored' },
  'notifications.generic.error': { message: 'An unexpected error occurred' },
  // Auth flows
  'notifications.password.reset.requested': { message: 'If the email exists, a reset link will be sent.' },
  'notifications.password.reset.success': { message: 'Password reset successful! You can now log in.' },
  'notifications.password.reset.failed': { message: 'Password reset failed. Please try again.' },
  // Users
  'notifications.user.deleted': { message: 'User deleted' },
  'notifications.user.delete.failed': { message: 'Delete user failed' },
  'notifications.user.update.failed': { message: 'Update failed' },
  'notifications.user.updated': { message: 'User updated' },
  // Staff
  'notifications.staff.created': { message: 'Staff registered successfully!' },
  'notifications.staff.create.failed': { message: 'Failed to register staff' },
  // Modules
  'notifications.module.toggled': { message: 'Module :{module} :{state}' },
  'notifications.module.toggle.failed': { message: 'Failed to update module' },
  // Portal / subscription management
  'notifications.portal.unavailable': { message: 'Portal URL unavailable' },
  'notifications.portal.unconfigured': { message: 'Billing portal not configured in this environment.' },
  'notifications.trial.started': { message: 'Trial started for :{days} days' },
  'notifications.trial.start.unavailable': { message: 'Start trial not available.' },
  'notifications.subscription.resumed': { message: 'Subscription resumed' },
  'notifications.subscription.resume.unavailable': { message: 'Resume not available.' },
  'notifications.subscription.paused': { message: 'Subscription paused' },
  'notifications.trial.canceled': { message: 'Trial canceled' },
  'notifications.subscription.pause.unavailable': { message: 'Pause not available.' },
  'notifications.trial.cancel.unavailable': { message: 'Cancel trial not available.' },
  // Settings / preferences
  'notifications.settings.notifications.enabled': { message: 'Notifications enabled' },
  'notifications.settings.notifications.disabled': { message: 'Notifications disabled' },
  // Session
  'notifications.session.expired': { message: 'Session expired. Please log in again.' },
  // Onboarding / OTP
  'notifications.onboarding.account.partial': { message: 'Account created but some features may need setup.' },
  'notifications.onboarding.network.error': { message: 'Network error. Check your connection and try again.' },
  'notifications.onboarding.code.invalid': { message: 'Invalid verification code. Please try again.' },
  'notifications.onboarding.code.expired': { message: 'Verification code expired. Request a new one.' },
  'notifications.onboarding.code.verify.failed': { message: 'Verification failed. Please try again.' },
  'notifications.onboarding.code.sent': { message: 'Verification code sent!' },
  'notifications.onboarding.sms.quota': { message: 'SMS quota exceeded. Try again later.' },
  'notifications.onboarding.phone.invalid': { message: 'Invalid phone number. Restart onboarding.' },
  'notifications.onboarding.rate.limit': { message: 'Too many requests. Please wait and retry.' },
  'notifications.onboarding.resend.failed': { message: 'Failed to resend verification code. Try again.' },
  // Analytics
  'notifications.analytics.refresh.unauthorized': { message: 'Not authorized to refresh metrics' },
  'notifications.analytics.refresh.failed': { message: 'Failed to refresh metrics' },
  // Visits & Washes
  'notifications.visit.logged': { message: 'Visit logged! You can now start a wash.' },
  'notifications.wash.started': { message: 'Wash started for POS client!' },
  'notifications.wash.ended': { message: 'Wash ended!' },
  'notifications.wash.end.failed': { message: 'Could not end wash.' },
};

const dictionaries: Record<Locale, Dictionary> = { en };

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function translate(key: string, params?: Record<string, unknown>): string {
  const dict = dictionaries[currentLocale];
  const entry = dict[key];
  let base = entry ? entry.message : key; // fallback to key if missing
  if (params) {
    for (const [pKey, value] of Object.entries(params)) {
      base = base.replace(new RegExp(`:{${pKey}}`, 'g'), String(value));
    }
  }
  return base;
}
