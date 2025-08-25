
// Extend Window interface to store RecaptchaVerifier instance
declare global {
  interface Window {
  recaptchaVerifier?: import("firebase/auth").RecaptchaVerifier | null | undefined;
  }
}

import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, setPersistence, browserLocalPersistence } from "firebase/auth";

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

// Configure persistence to localStorage for redirect compatibility
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
    console.warn('Failed to set Firebase persistence:', error);
  });
}


/**
 * Renders an invisible reCAPTCHA widget into the given container.
 * (Modular v9+ signature: (container, params, auth))
 */
// Legacy function (kept for compatibility) now proxies to global
export async function makeRecaptcha(): Promise<RecaptchaVerifier> { return getGlobalRecaptcha(); }

let globalRecaptchaPromise: Promise<RecaptchaVerifier> | null = null;

/**
 * Ensure a single invisible reCAPTCHA instance mounted in a stable <div id="global-recaptcha-container" />
 * appended to document.body (outside React HMR tree) so it is not removed during fast refresh.
 */
export function getGlobalRecaptcha(): Promise<RecaptchaVerifier> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('recaptcha only available in browser'));
  }
  if (window.recaptchaVerifier) {
    return Promise.resolve(window.recaptchaVerifier as RecaptchaVerifier);
  }
  if (globalRecaptchaPromise) return globalRecaptchaPromise;

  globalRecaptchaPromise = new Promise<RecaptchaVerifier>((resolve, reject) => {
    try {
      let container = document.getElementById('global-recaptcha-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'global-recaptcha-container';
        // Keep it off-screen / hidden but present
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);
      }
      const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible', badge: 'bottomright' });
      verifier.render().then(() => {
        window.recaptchaVerifier = verifier;
        resolve(verifier);
      }).catch(reject);
    } catch (e) {
      globalRecaptchaPromise = null;
      reject(e);
    }
  });
  return globalRecaptchaPromise;
}
