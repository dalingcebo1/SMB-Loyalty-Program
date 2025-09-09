/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import api from "../api/api";
import SplashScreen from "../components/SplashScreen";
import { auth as firebaseAuth, isFirebaseEnabled } from "../firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useNavigate } from 'react-router-dom';

export interface User {
  id: number;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  capabilities?: string[];
  tenant_id?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  socialLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Backend login response schema
interface LoginResponseServer {
  access_token: string;
  token_type: string;
  onboarding_required: boolean;
  next_step?: string;
  user: {
    id: number;
    email: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    role: string;
    tenant_id?: string;
    onboarded?: boolean;
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false); // prevents double init (React 18 StrictMode)
  const lastMeFetch = useRef<number>(0);
  let meInFlight: Promise<User | null> | null = null; // request coalescing (scoped per render pass)
  const navigate = useNavigate();

  // Always attach token to every request
  useEffect(() => {
    const interceptor = api.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, []);

  // On mount, check for stored token and fetch user (popup flow has no redirect handling)
  useEffect(() => {
    if (initializedRef.current) return; // guard against strict mode double invoke
    initializedRef.current = true;
    (async () => {
      const t = localStorage.getItem("token");
      if (!t) {
        setUser(null); setLoading(false); return;
      }
      api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
      try {
        await internalFetchMe();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const internalFetchMe = async (force = false): Promise<User | null> => {
    const now = Date.now();
    if (!force && user && (now - lastMeFetch.current) < 60000) {
      return user; // recent cache (<60s)
    }
    if (meInFlight) return meInFlight; // coalesce
    const token = localStorage.getItem('token');
    if (!token) { setUser(null); return null; }
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    meInFlight = api.get("/auth/me").then(res => {
      const u = res.data;
      const newUser: User = {
        id: u.id,
        email: u.email,
        phone: u.phone,
        firstName: u.first_name || u.firstName || "",
        lastName: u.last_name || u.lastName || "",
        role: u.role,
        capabilities: u.capabilities || [],
        tenant_id: u.tenant_id,
      };
      setUser(newUser);
      try { localStorage.setItem('cachedRole', newUser.role); } catch { /* ignore */ }
      lastMeFetch.current = Date.now();
      return newUser;
    }).catch(err => {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        let email: string | undefined;
  try { const payload = JSON.parse(atob(token.split('.')[1] || '')) as { sub?: string }; email = payload.sub; } catch { /* ignore decode errors */ }
        const cachedRole = localStorage.getItem('cachedRole');
        if (!(cachedRole && ['staff','admin','developer'].includes(cachedRole)) && !window.location.pathname.startsWith('/onboarding')) {
          navigate('/onboarding', { replace: true, state: { email, fromSocialLogin: true } });
        }
      } else {
        console.error('Failed /auth/me', err);
        localStorage.removeItem('token');
        delete api.defaults.headers.common["Authorization"];
        setUser(null);
      }
      return null;
    }).finally(() => { meInFlight = null; });
    return meInFlight;
  };

  const login = async (email: string, password: string): Promise<User> => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);

  // Expect LoginResponse with onboarding flags
  const res = await api.post<LoginResponseServer>(
      "/auth/login",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // Handle onboarding-required scenario
  if (res.data.onboarding_required) {
      const token = res.data.access_token;
      localStorage.setItem("token", token);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      // Redirect to onboarding flow
      navigate('/onboarding', { state: { email, password } });
      // Reject to inform caller
      throw { response: { status: 403 } };
    }
    const token = res.data.access_token;
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    const u = res.data.user; // trust login response
    try { localStorage.setItem('cachedRole', u.role); } catch { /* ignore */ }
    const newUser: User = {
      id: u.id,
      email: u.email,
      phone: u.phone || "",
      firstName: u.first_name || "",
      lastName: u.last_name || "",
      role: u.role,
      capabilities: Array.isArray((u as { capabilities?: string[] }).capabilities) ? (u as { capabilities?: string[] }).capabilities : [],
      tenant_id: (u as { tenant_id?: string }).tenant_id,
    };
    setUser(newUser);
    lastMeFetch.current = Date.now();
  // Role-based post-login navigation
  if (newUser.role === 'admin') navigate('/admin', { replace: true });
  else if (newUser.role === 'staff') navigate('/staff/dashboard', { replace: true });
    return newUser;
  };

  const signup = async (email: string, password: string) => {
    await api.post("/auth/signup", { email, password });
    // Mark as just onboarded to show welcome modal
    localStorage.setItem("justOnboarded", "true");
  };

  const loginWithToken = async (token: string): Promise<User> => {
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const u = await internalFetchMe(true); // force fetch
    if (!u) throw new Error('Unable to load user');
  if (u.role === 'admin') navigate('/admin', { replace: true });
  else if (u.role === 'staff') navigate('/staff/dashboard', { replace: true });
    return u;
  };

  const logout = async () => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  // Popup-based Google social login
  const socialLogin = async (): Promise<void> => {
    console.log("🚀 Starting Google OAuth popup flow...");
    try {
      if (!isFirebaseEnabled || !firebaseAuth) {
        // Provide clear error for UI to show and avoid undefined access
        const msg = "Social login is disabled: missing Firebase configuration.";
        console.warn(msg);
        throw new Error(msg);
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      provider.addScope('email');
      provider.addScope('profile');

      const popupResult = await signInWithPopup(firebaseAuth, provider);
      console.log("✅ Firebase popup success for:", popupResult.user.email);

      const idToken = await popupResult.user.getIdToken();
      console.log("� Got Firebase ID token length:", idToken.length);

      const res = await api.post<LoginResponseServer>("/auth/social-login", { id_token: idToken });
      console.log("🎯 Backend social-login response:", res.data);

      // If onboarding required, store token and navigate accordingly
      if (res.data.onboarding_required) {
        const token = res.data.access_token;
        localStorage.setItem("token", token);
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        if (res.data.next_step === "PROFILE_INFO") {
          navigate('/onboarding', { state: { email: res.data.user.email, fromSocialLogin: true } });
          return;
        }
        if (res.data.next_step === "PHONE_VERIFICATION") {
          const hasProfile = res.data.user.first_name && res.data.user.last_name;
            navigate('/onboarding', { 
              state: { 
                email: res.data.user.email,
                firstName: res.data.user.first_name,
                lastName: res.data.user.last_name,
                fromSocialLogin: true,
                skipProfileStep: !!hasProfile
              } 
            });
          return;
        }
      }

      // Fully onboarded user path
      const token = res.data.access_token;
      await loginWithToken(token);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      console.error("❌ Social login popup failed:", err);
      // Common Firebase error codes assistance
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-blocked') {
        alert('Popup was blocked. Please allow popups for this site and try again.');
      } else if (code === 'auth/popup-closed-by-user') {
        alert('Popup closed before completing sign-in. Please try again.');
      } else if (code === 'auth/unauthorized-domain') {
        alert('Current domain not authorized in Firebase Authentication settings.');
      } else {
        alert('Social login failed. Check console for details.');
      }
      throw err;
    }
  };

  const refreshUser = async () => { await internalFetchMe(true); };

  // Only render children when loading is false
  if (loading) {
    return <SplashScreen />;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, loginWithToken, logout, refreshUser, socialLogin }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
