// src/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

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

/**
 * Always clears any previously-rendered widget,
 * then instantiates & renders a fresh invisible reCAPTCHA.
 */
export async function makeRecaptcha(containerId: string): Promise<RecaptchaVerifier> {
  // clear old widget if present
  const old = (window as any).recaptchaVerifier as RecaptchaVerifier | undefined;
  if (old) {
    try { old.clear(); } catch {}
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = "";
  }

  // create & render new
  const verifier = new RecaptchaVerifier(
    auth,
    containerId,
    { size: "invisible" }
  );
  await verifier.render();
  (window as any).recaptchaVerifier = verifier;
  return verifier;
}
