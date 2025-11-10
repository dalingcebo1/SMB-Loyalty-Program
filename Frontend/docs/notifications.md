# Notifications Module

Centralized helpers for user feedback live in `src/utils/notifications.ts`.

## Goals
- Consistent toast styling (position, duration, interaction).
- Analytics tracking for every toast via `track('toast', {...})`.
- Dedupe rapid duplicate messages (2.5s interval) to avoid spam.
- Explicit helpers for common flows (order confirmed, payment success, clipboard, redeem outcomes).

## Basic Usage
```ts
import { notifySuccess, notifyError } from '../utils/notifications';

notifySuccess('Profile updated successfully');
notifyError('Unable to load data');
```

## Dedupe Behavior
Messages shown within 2500ms repeat are suppressed. To bypass (e.g. looping progress), pass `skipDedupe: true`:
```ts
notifyInfo('Processing batch...', { skipDedupe: true, autoClose: 1500 });
```

## Specialized Helpers
| Helper | Purpose |
| ------ | ------- |
| `notifyOrderConfirmed(orderId)` | Success after order confirmation (emoji) |
| `notifyPaymentSuccess(amountCents)` | Payment succeeded |
| `notifyClipboard(message?)` | Clipboard copy feedback |
| `notifyRedeemSuccess()` / `notifyRedeemError()` | Loyalty redemption outcomes |
| `notifyBookingConfirmed()` | Booking confirmed -> redirect to payment |

## Adding New Helpers
1. Add a function inside `notifications.ts` calling one of the base notify methods.
2. Include analytics context keys (e.g. `context: 'booking'`).
3. Export and document here.

## Testing
`notifications.test.tsx` verifies wrappers invoke toast and tracking. Add new tests for helpers or dedupe if logic changes.

## Migration Pattern
1. Replace `import { toast } from 'react-toastify'` with helper imports.
2. Map `toast.success(...)` => `notifySuccess(...)`, etc.
3. Remove inline options unless differing intentionally (override with opts param).
4. Ensure a single `<ToastContainer />` remains at page root (already handled in user pages).

## Pitfalls
- Avoid passing large React nodes; use plain strings for simplicity & snapshot stability.
- If you must show same message rapidly (e.g., streaming statuses), disable dedupe selectively.
- Keep autoClose reasonable (2-4s) to reduce cognitive load.

## i18n Keys
Toast messages can be rendered via translation keys using `notifySuccessKey`, `notifyErrorKey`, etc.

Common plan management keys:

| Key | Default English |
| --- | ---------------- |
| `notifications.plan.created` | Plan created |
| `notifications.plan.updated` | Plan updated |
| `notifications.plan.archived` | Plan archived |
| `notifications.plan.restored` | Plan restored |
| `notifications.generic.error` | An unexpected error occurred |

Usage:
```ts
import { notifySuccessKey } from '../utils/notifications';
notifySuccessKey('notifications.plan.created');
```

Fallback: if a key is missing it will display the key name to highlight gaps.

### Additional i18n Key Reference
The dictionary in `src/utils/i18n.ts` groups many more domains. Below is a concise reference (English defaults shown). Use these instead of ad‑hoc strings when the message matches.

| Domain | Key | Message / Placeholders |
| ------ | --- | ---------------------- |
| Session | `notifications.session.expired` | Session expired. Please log in again. |
| Settings | `notifications.settings.notifications.enabled` | Notifications enabled |
| Settings | `notifications.settings.notifications.disabled` | Notifications disabled |
| Onboarding | `notifications.onboarding.account.partial` | Account created but some features may need setup. |
| Onboarding | `notifications.onboarding.network.error` | Network error. Check your connection and try again. |
| Onboarding | `notifications.onboarding.code.invalid` | Invalid verification code. Please try again. |
| Onboarding | `notifications.onboarding.code.expired` | Verification code expired. Request a new one. |
| Onboarding | `notifications.onboarding.code.verify.failed` | Verification failed. Please try again. |
| Onboarding | `notifications.onboarding.code.sent` | Verification code sent! |
| Onboarding | `notifications.onboarding.sms.quota` | SMS quota exceeded. Try again later. |
| Onboarding | `notifications.onboarding.phone.invalid` | Invalid phone number. Restart onboarding. |
| Onboarding | `notifications.onboarding.rate.limit` | Too many requests. Please wait and retry. |
| Onboarding | `notifications.onboarding.resend.failed` | Failed to resend verification code. Try again. |
| Users | `notifications.user.deleted` | User deleted |
| Users | `notifications.user.delete.failed` | Delete user failed |
| Users | `notifications.user.updated` | User updated |
| Users | `notifications.user.update.failed` | Update failed |
| Staff | `notifications.staff.created` | Staff registered successfully! |
| Staff | `notifications.staff.create.failed` | Failed to register staff |
| Modules | `notifications.module.toggled` | Module :{module} :{state} |
| Modules | `notifications.module.toggle.failed` | Failed to update module |
| Plans | `notifications.plan.created` | Plan created |
| Plans | `notifications.plan.updated` | Plan updated |
| Plans | `notifications.plan.archived` | Plan archived |
| Plans | `notifications.plan.restored` | Plan restored |
| Plans | `notifications.plan.assign.failed` | (Add if needed for assign errors) |
| Trials | `notifications.trial.started` | Trial started for :{days} days |
| Trials | `notifications.trial.start.unavailable` | Start trial not available. |
| Trials | `notifications.trial.canceled` | Trial canceled |
| Trials | `notifications.trial.cancel.unavailable` | Cancel trial not available. |
| Subscription | `notifications.subscription.resumed` | Subscription resumed |
| Subscription | `notifications.subscription.resume.unavailable` | Resume not available. |
| Subscription | `notifications.subscription.paused` | Subscription paused |
| Subscription | `notifications.subscription.pause.unavailable` | Pause not available. |
| Portal | `notifications.portal.unavailable` | Portal URL unavailable |
| Portal | `notifications.portal.unconfigured` | Billing portal not configured in this environment. |
| Analytics | `notifications.analytics.refresh.unauthorized` | Not authorized to refresh metrics |
| Analytics | `notifications.analytics.refresh.failed` | Failed to refresh metrics |
| Visits | `notifications.visit.logged` | Visit logged! You can now start a wash. |
| Washes | `notifications.wash.started` | Wash started for POS client! |
| Washes | `notifications.wash.ended` | Wash ended! |
| Washes | `notifications.wash.end.failed` | Could not end wash. |

Placeholder syntax `:{name}` is replaced via `translate(key, { name: value })`:
```ts
notifySuccessKey('notifications.trial.started', { days: 14 });
notifySuccessKey('notifications.module.toggled', { module: 'loyalty', state: 'enabled' });
```

If you add a new key:
1. Add it to `i18n.ts` under the existing `en` dictionary.
2. Prefer a domain prefix (e.g. `notifications.inventory.item.added`).
3. Use placeholders instead of string concatenation for dynamic data.
4. Update this table (keep it alphabetically grouped by Domain if it grows much larger).

## User Preference (Silent Mode)
Users can toggle toast visibility (persisted in localStorage) via:
```ts
import { setNotificationsEnabled } from '../utils/notifications';
setNotificationsEnabled(false); // disable toasts
```
When disabled, tracking still fires but no UI toast appears.

UI example (Account page toggle):
```tsx
import { getNotificationsEnabled, setNotificationsEnabled, notifySuccessKey } from '../utils/notifications';
const [on, setOn] = useState(getNotificationsEnabled());
const toggle = () => { const next = !on; setNotificationsEnabled(next); setOn(next); notifySuccessKey(next ? 'notifications.settings.notifications.enabled' : 'notifications.settings.notifications.disabled'); };
<button onClick={toggle}>{on ? 'Disable Toasts' : 'Enable Toasts'}</button>
```

## Future Enhancements
- Additional locale dictionaries & dynamic loading.
- Queueing & stacking logic.
- Rich ARIA live-region management.
- Per-context mute (e.g. marketing vs. transactional).
