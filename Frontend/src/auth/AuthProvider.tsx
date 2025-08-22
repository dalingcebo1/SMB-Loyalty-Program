/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import api from "../api/api";
import SplashScreen from "../components/SplashScreen";
import { auth as firebaseAuth } from "../firebase";
import { GoogleAuthProvider } from "firebase/auth";
import { useNavigate } from 'react-router-dom';

export interface User {
  id: number;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
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

  // On mount, check for stored token and fetch user, also check for redirect results
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        console.log("🔄 Initializing redirect result handler...");
        const socialLoginInProgress = localStorage.getItem('socialLoginInProgress');
        console.log("🔍 socialLoginInProgress flag:", socialLoginInProgress);
        
        // Always check for redirect result, not just when flag is set
        console.log("🔍 Checking for Firebase redirect result...");
        const { getRedirectResult } = await import('firebase/auth');
        const result = await getRedirectResult(firebaseAuth);
        console.log("🔍 Firebase redirect result:", result);
        
        if (result) {
          console.log("📱 Processing redirect result for:", result.user.email);
          console.log("🎫 User details:", {
            email: result.user.email,
            displayName: result.user.displayName,
            uid: result.user.uid
          });
          
          // Clear the flag
          localStorage.removeItem('socialLoginInProgress');
          
          const idToken = await result.user.getIdToken();
          console.log("🎫 Got Firebase ID token, length:", idToken.length);
          
          const res = await api.post<LoginResponseServer>("/auth/social-login", { id_token: idToken });
          console.log("🎯 Backend exchange successful:", res.data);
          
          if (res.data.onboarding_required) {
            const token = res.data.access_token;
            localStorage.setItem("token", token);
            api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
            
            console.log("🚨 Redirecting to onboarding from redirect result");
            console.log("🚨 Next step:", res.data.next_step);
            console.log("🚨 User data:", res.data.user);
            
            if (res.data.next_step === "PROFILE_INFO") {
              console.log("➡️ Navigating to profile completion");
              navigate('/onboarding', { 
                state: { 
                  email: res.data.user.email,
                  fromSocialLogin: true 
                } 
              });
            } else if (res.data.next_step === "PHONE_VERIFICATION") {
              console.log("➡️ Navigating to phone verification");
              
              // Check if user has complete profile data
              const hasProfileData = res.data.user.first_name && res.data.user.last_name;
              
              if (hasProfileData) {
                console.log("✅ User has profile data, skipping to phone verification");
                navigate('/onboarding', { 
                  state: { 
                    email: res.data.user.email,
                    firstName: res.data.user.first_name,
                    lastName: res.data.user.last_name,
                    fromSocialLogin: true,
                    skipProfileStep: true
                  } 
                });
              } else {
                console.log("⚠️ User missing profile data, starting with profile step");
                navigate('/onboarding', { 
                  state: { 
                    email: res.data.user.email,
                    fromSocialLogin: true 
                  } 
                });
              }
            }
            setLoading(false);
            return;
          }
          
          // Complete login for fully onboarded users
          console.log("✅ User fully onboarded, completing login");
          const token = res.data.access_token;
          await loginWithToken(token);
          console.log("✅ Login completed, navigating to dashboard");
          navigate('/', { replace: true });
          setLoading(false);
          return;
        } else {
          console.log("❌ No redirect result found");
          if (socialLoginInProgress) {
            console.log("🧹 Cleaning up socialLoginInProgress flag");
            localStorage.removeItem('socialLoginInProgress');
          }
        }
      } catch (error) {
        console.error("❌ Error handling redirect result:", error);
        localStorage.removeItem('socialLoginInProgress');
      }
    };

    const initializeAuth = async () => {
      await handleRedirectResult();
      
      const t = localStorage.getItem("token");
      if (t) {
        api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
        api
          .get("/auth/me")
          .then((res) => {
            const u = res.data;
            console.log("auth/me response", u); // <-- Add this
            setUser({
              id: u.id,
              email: u.email,
              phone: u.phone,
              firstName: u.first_name || u.firstName || "",
              lastName: u.last_name || u.lastName || "",
              role: u.role,
            });
          })
          .catch((err) => {
            console.error("Failed to fetch /auth/me", err);
            localStorage.removeItem("token");
            delete api.defaults.headers.common["Authorization"];
            setUser(null);
          })
          .finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    initializeAuth();
  }, [navigate]);

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

    const me = await api.get("/auth/me");
    const u = me.data;
    const newUser: User = {
      id: u.id,
      email: u.email,
      phone: u.phone,
      firstName: u.first_name || u.firstName || "",
      lastName: u.last_name || u.lastName || "",
      role: u.role,
    };
    setUser(newUser);
    return newUser;
  };

  const signup = async (email: string, password: string) => {
    await api.post("/auth/signup", { email, password });
    // Mark as just onboarded to show welcome modal
    localStorage.setItem("justOnboarded", "true");
  };

  const loginWithToken = async (token: string): Promise<User> => {
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    const me = await api.get("/auth/me");
    const u = me.data;
    const newUser: User = {
      id: u.id,
      email: u.email,
      phone: u.phone,
      firstName: u.first_name || u.firstName || "",
      lastName: u.last_name || u.lastName || "",
      role: u.role,
    };
    setUser(newUser);
    return newUser;
  };

  const logout = async () => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  // Replace hybrid socialLogin with redirect-only flow
  const socialLogin = async (): Promise<void> => {
    console.log("🚀 Starting Google OAuth redirect flow...");
    
    // Start Google OAuth redirect flow
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    provider.addScope('email');
    provider.addScope('profile');
    
    console.log("🏷️ Setting socialLoginInProgress flag...");
    localStorage.setItem('socialLoginInProgress', 'true');
    
    console.log("🔄 Initiating signInWithRedirect...");
    const { signInWithRedirect } = await import('firebase/auth');
    await signInWithRedirect(firebaseAuth, provider);
    
    console.log("⚠️ This line should never execute (redirect should happen)");
    // Execution will stop due to redirect
  };

  const refreshUser = async () => {
    const t = localStorage.getItem("token");
    if (t) {
      api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
      try {
        const res = await api.get("/auth/me");
        const u = res.data;
        setUser({
          id: u.id,
          email: u.email,
          phone: u.phone,
          firstName: u.first_name || u.firstName || "",
          lastName: u.last_name || u.lastName || "",
          role: u.role,
        });
  } catch {
        localStorage.removeItem("token");
        delete api.defaults.headers.common["Authorization"];
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

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
