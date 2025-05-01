// src/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onIdTokenChanged, signOut as fbSignOut
} from 'firebase/auth';
import api from '../api/api';

// src/auth/AuthProvider.tsx
const firebase = initializeApp({
    apiKey:   import.meta.env.VITE_FB_API_KEY,
    authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
    projectId:  import.meta.env.VITE_FB_PROJECT_ID,
  });
  

const auth = getAuth(firebase);

interface User { uid: string; name: string; email: string | null; }
interface Ctx {
  user: User | null;
  loginWithGoogle(): Promise<void>;
  logout(): Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);



export const AuthProvider: React.FC<{children:React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User|null>(null);

  useEffect(() => onIdTokenChanged(auth, async fbUser => {
    if (!fbUser) { setUser(null); return; }
    const token = await fbUser.getIdToken();
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    setUser({ uid: fbUser.uid, name: fbUser.displayName ?? '', email: fbUser.email });
  }), []);

  const loginWithGoogle = async () => { await signInWithPopup(auth, new GoogleAuthProvider()); };
  const logout = async () => { await fbSignOut(auth); setUser(null); };

  return <AuthCtx.Provider value={{ user, loginWithGoogle, logout }}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => useContext(AuthCtx);
