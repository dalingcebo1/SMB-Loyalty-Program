// src/auth/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInAnonymously,
  sendPasswordResetEmail,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onIdTokenChanged,
  signOut as fbSignOut,
  User as FirebaseUser,
  UserCredential,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

// 1) Initialize Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
};
initializeApp(firebaseConfig);
const auth = getAuth();

interface User {
  uid: string;
  name: string;
  email: string;
}

interface AuthCtxType {
  user: User | null;

  /** Anonymous sign-in */
  signInAnon(): Promise<UserCredential>;

  /** Social sign-ins return the user credential */
  loginWithGoogle(): Promise<UserCredential>;
  loginWithApple(): Promise<UserCredential>;

  /** Email/password returns void (we only care that it succeeded) */
  signupWithEmail(email: string, password: string): Promise<void>;
  loginWithEmail(email: string, password: string): Promise<void>;

  resetPassword(email: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthCtx = createContext<AuthCtxType>(null!);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [, setOnboardingRequired] = useState(false);
  const navigate = useNavigate();

  // Single listener for token changes (login / logout / token refresh)
  useEffect(() => {
    return onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
      // 1) signed out
      if (!fbUser) {
        setUser(null);
        delete api.defaults.headers.common.Authorization;
        return;
      }

      // 2) set Firebase token on axios
      const token = await fbUser.getIdToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      // 3) check our backend for the onboarded profile
      try {
        const res = await api.get("/auth/me");
        const me = res.data;
        setUser({
          uid: fbUser.uid,
          name: `${me.first_name} ${me.last_name}`,
          email: me.email,
        });
        setOnboardingRequired(false);
      } catch (err: any) {
        // not yet onboarded? bounce them into onboarding
        if (err.response?.status === 404) {
          setUser(null);
          setOnboardingRequired(true);
          navigate("/onboarding");
        } else {
          setOnboardingRequired(false);
          console.error("Could not fetch /auth/me:", err);
        }
      }
    });
  }, [navigate]);

  // 4) Implement each method

  const signInAnon = () => signInAnonymously(auth);

  const loginWithGoogle = () =>
    signInWithPopup(auth, new GoogleAuthProvider());

  const loginWithApple = () =>
    signInWithPopup(auth, new OAuthProvider("apple.com"));

  const signupWithEmail = async (
    email: string,
    password: string
  ): Promise<void> => {
    // await so that this truly returns Promise<void>
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = (email: string) =>
    sendPasswordResetEmail(auth, email);

  const logout = () => fbSignOut(auth);

  return (
    <AuthCtx.Provider
      value={{
        user,
        signInAnon,
        loginWithGoogle,
        loginWithApple,
        signupWithEmail,
        loginWithEmail,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
