// src/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

// Your Firebase config from .env
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize or reuse the Firebase app
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Export the Auth instance
export const auth = getAuth(app);

/**
 * Idempotently instantiate an invisible reCAPTCHA verifier.
 * Always uses the real Firebase endpoints (no emulator).
 */
export async function makeRecaptcha(containerId: string): Promise<RecaptchaVerifier> {
  // Clear any previously rendered widget
  const existing = (window as any).recaptchaVerifier as RecaptchaVerifier | undefined;
  if (existing) {
    try { existing.clear(); } catch {}
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = "";
  }

  // Create and render a new invisible reCAPTCHA
  const verifier = new RecaptchaVerifier(
    auth,
    containerId,
    { size: "invisible" }
  );
  await verifier.render();

  // Store on window for debugging or later reference
  (window as any).recaptchaVerifier = verifier;
  return verifier;
}
