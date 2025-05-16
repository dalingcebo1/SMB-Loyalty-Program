import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import api from "../api/api";

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
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  // On mount, check for stored token and fetch user
  useEffect(() => {
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
  }, []);

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);

    const res = await api.post<{ access_token: string }>(
      "/auth/login",
      form,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const token = res.data.access_token;
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    const me = await api.get("/auth/me");
    const u = me.data;
    setUser({
      id: u.id,
      email: u.email,
      phone: u.phone,
      firstName: u.first_name || u.firstName || "",
      lastName: u.last_name || u.lastName || "",
      role: u.role,
    });
  };

  const signup = async (email: string, password: string) => {
    await api.post("/auth/signup", { email, password });
  };

  const loginWithToken = async (token: string) => {
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    const me = await api.get("/auth/me");
    const u = me.data;
    setUser({
      id: u.id,
      email: u.email,
      phone: u.phone,
      firstName: u.first_name || u.firstName || "",
      lastName: u.last_name || u.lastName || "",
      role: u.role,
    });
  };

  const logout = async () => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
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
      } catch (err) {
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
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, loginWithToken, logout, refreshUser }}
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
