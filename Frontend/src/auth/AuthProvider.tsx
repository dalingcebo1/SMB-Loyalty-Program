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
  sendPasswordResetEmail,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onIdTokenChanged,
  signOut as fbSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

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
  loginWithGoogle(): Promise<void>;
  loginWithApple(): Promise<void>;
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
  const navigate = useNavigate();

  useEffect(() => {
    // single listener for any sign-in / sign-out event
    return onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
      // 1) signed out
      if (!fbUser) {
        setUser(null);
        delete api.defaults.headers.common.Authorization;
        return;
      }

      // 2) set Firebase token header
      const token = await fbUser.getIdToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      // 3) ask our backend if they have a profile
      try {
        const res = await api.get("/auth/me");
        const me = res.data;
        setUser({
          uid: fbUser.uid,
          name: `${me.first_name} ${me.last_name}`,
          email: me.email,
        });
      } catch (err: any) {
        // if 404 → not onboarded yet
        if (err.response?.status === 404) {
          await fbSignOut(auth);
          delete api.defaults.headers.common.Authorization;
          navigate("/onboarding");
        } else {
          console.error("Could not fetch /auth/me:", err);
        }
      }
    });
  }, [navigate]);

  // Social providers
  const loginWithGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const loginWithApple = async () => {
    await signInWithPopup(auth, new OAuthProvider("apple.com"));
  };

  // Email / Password
  const signupWithEmail = async (email: string, password: string): Promise<void> => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
  const resetPassword = (email: string) =>
    sendPasswordResetEmail(auth, email);

  // Sign out
  const logout = () => fbSignOut(auth);

  return (
    <AuthCtx.Provider
      value={{
        user,
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
