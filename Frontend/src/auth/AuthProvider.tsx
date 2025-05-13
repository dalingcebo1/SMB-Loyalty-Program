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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for stored token
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
      api
        .get("/auth/me")
        .then((res) => {
          const u = res.data;
          setUser({
            ...u,
            firstName: u.first_name,
            lastName: u.last_name,
          });
        })
        .catch(() => {
          localStorage.removeItem("token");
          delete api.defaults.headers.common["Authorization"];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Email/password login → OAuth2 form/urlencoded
  const login = async (email: string, password: string) => {
    // build a URLSearchParams body
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

    const me = await api.get<User>("/auth/me");
    setUser(me.data);
  };

  // Start signup (creates pending user)
  const signup = async (email: string, password: string) => {
    await api.post("/auth/signup", { email, password });
  };

  // Finalize login after OTP confirm
  const loginWithToken = async (token: string) => {
    localStorage.setItem("token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    const me = await api.get<User>("/auth/me");
    setUser(me.data);
  };

  const logout = async () => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };
  
  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, loginWithToken, logout }}
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
