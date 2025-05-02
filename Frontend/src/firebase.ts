// src/firebase.ts

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your Firebase configuration; make sure these are set in your .env as VITE_ prefixed variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase once
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Export the shared Auth instance
export const auth = getAuth(app);

export default app;
