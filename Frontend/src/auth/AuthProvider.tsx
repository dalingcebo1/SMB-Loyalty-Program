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
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onIdTokenChanged,
    signOut as fbSignOut,
    User as FirebaseUser,
  } from "firebase/auth";
  import api from "../api/api";
  
  const firebaseConfig = {
    apiKey:   import.meta.env.VITE_FB_API_KEY,
    authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
    projectId:  import.meta.env.VITE_FB_PROJECT_ID,
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
    logout(): Promise<void>;
  }
  
  const AuthCtx = createContext<AuthCtxType>(null!);
  
  export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
  
    // Listen for auth state & set Axios header
    useEffect(() => {
      return onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (!fbUser) {
          setUser(null);
          delete api.defaults.headers.common.Authorization;
          return;
        }
        const token = await fbUser.getIdToken();
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        setUser({
          uid:   fbUser.uid,
          name:  fbUser.displayName ?? "",
          email: fbUser.email!,
        });
      });
    }, []);
  
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
  
    const loginWithEmail = async (email: string, password: string): Promise<void> => {
      await signInWithEmailAndPassword(auth, email, password);
    };
  
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
          logout,
        }}
      >
        {children}
      </AuthCtx.Provider>
    );
  };
  
  export const useAuth = () => useContext(AuthCtx);
  