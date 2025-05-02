// src/auth/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
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
    const unsubscribe = onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        setUser(null);
        delete api.defaults.headers.common.Authorization;
        return;
      }

      // Get fresh ID token
      const token = await fbUser.getIdToken();
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      try {
        // Check if this Firebase user is onboarded
        const res = await api.get("/auth/me");
        const me = res.data;
        setUser({
          uid: fbUser.uid,
          name: `${me.first_name} ${me.last_name}`,
          email: me.email,
        });
      } catch (err: any) {
        // Not onboarded → sign out and redirect
        await fbSignOut(auth);
        delete api.defaults.headers.common.Authorization;
        navigate("/signup", { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const loginWithApple = async () => {
    await signInWithPopup(auth, new OAuthProvider("apple.com"));
  };

  const signupWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await fbSignOut(auth);
    setUser(null);
    delete api.defaults.headers.common.Authorization;
  };

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
