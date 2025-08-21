import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

// Your Firebase config from VITE_… env vars
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
 * Renders an invisible reCAPTCHA widget into the given container.
 * (Modular v9+ signature: (container, params, auth))
 */
export async function makeRecaptcha(
  container: string | HTMLElement
): Promise<RecaptchaVerifier> {
  // Create a fresh invisible reCAPTCHA

  // Clear any existing widget
  const prior = (window as any).recaptchaVerifier as RecaptchaVerifier | undefined;
  if (prior) {
    try { prior.clear(); } catch {}
    if (typeof container === "string") {
      const el = document.getElementById(container);
      if (el) el.innerHTML = "";
    }
  }

  const verifier = new RecaptchaVerifier(
    auth,
    container,
    { size: "invisible", badge: "bottomright" }
  );
  await verifier.render();
  (window as any).recaptchaVerifier = verifier;
  return verifier;
}
