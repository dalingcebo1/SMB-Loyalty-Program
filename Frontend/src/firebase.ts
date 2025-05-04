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
 * container: either the DIV’s ID _or_ the actual HTMLElement.
 */
export async function makeRecaptcha(
  container: string | HTMLElement
): Promise<RecaptchaVerifier> {
  // tear down any old widget
  const old = (window as any).recaptchaVerifier as RecaptchaVerifier | undefined;
  if (old) {
    try { old.clear(); } catch {}
    if (typeof container === "string") {
      const el = document.getElementById(container);
      if (el) el.innerHTML = "";
    }
  }

  // v9 modular signature: (auth, container, parameters)
  const verifier = new RecaptchaVerifier(
    auth,
    container,
    { size: "invisible", badge: "bottomright" }
  );
  await verifier.render();
  (window as any).recaptchaVerifier = verifier;
  return verifier;
}
