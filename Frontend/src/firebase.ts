// src/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  RecaptchaVerifier,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);

// DEV → point at local emulator
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true });
}

/**
 * Renders invisible reCAPTCHA.
 * DEV → stubbed so no network call.
 * PROD → real invisible reCAPTCHA.
 */
export async function makeRecaptcha(containerId: string) {
  if (import.meta.env.DEV) {
    // fake verifier that satisfies Firebase’s internal expectations:
    const fakeVerifier = {
      render: () => Promise.resolve(0),
      clear: () => {},
      verify: () => Promise.resolve(""),
      _reset: () => {},       // <— this is critical
      type: "invisible" as const
    };
    ;(window as any).recaptchaVerifier = fakeVerifier;
    return fakeVerifier;
  }

  // production: real recaptcha
  const verifier = new RecaptchaVerifier(
    auth,
    containerId,
    {
      size: "invisible",
      siteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY,
    }
  );
  await verifier.render();
  ;(window as any).recaptchaVerifier = verifier;
  return verifier;
}
