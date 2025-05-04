// src/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

// Your Firebase config, wired up from VITE_… env vars
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize or reuse existing app
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);

/**
 * Idempotently render an invisible reCAPTCHA widget 
 * against the real Firebase endpoints (no emulator).
 */
export async function makeRecaptcha(containerId: string): Promise<RecaptchaVerifier> {
  // Clear any prior widget
  const existing = (window as any).recaptchaVerifier as RecaptchaVerifier|undefined;
  if (existing) {
    try { existing.clear(); } catch {}
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = "";
  }

  // Render a fresh invisible reCAPTCHA
  const verifier = new RecaptchaVerifier(
    auth,
    containerId,
    { size: "invisible", badge: "bottomright" }
  );
  await verifier.render();
  (window as any).recaptchaVerifier = verifier;
  return verifier;
}
