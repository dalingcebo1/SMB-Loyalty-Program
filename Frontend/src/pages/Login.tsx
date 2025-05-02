// src/pages/Login.tsx

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

interface FormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { loginWithEmail, loginWithGoogle, loginWithApple } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  // Clear any lingering session so we start fresh
  useEffect(() => {
    const auth = getAuth();
    if (auth.currentUser) signOut(auth).catch(console.warn);
  }, []);

  // Email/password login
  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      await loginWithEmail(data.email, data.password);
      await api.get("/auth/me");
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err.response?.status === 404) {
        return navigate("/signup", { replace: true });
      }
      switch (err.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setAuthError("The email and password provided are incorrect.");
          break;
        case "auth/too-many-requests":
          setAuthError("Too many attempts. Please try again later.");
          break;
        default:
          setAuthError(err.message || "Login failed. Please try again.");
      }
    }
  };

  // Social login
  const handleSocialLogin = async (
    signInFn: () => Promise<any>,
    providerName: "Google" | "Apple"
  ) => {
    setAuthError(null);
    try {
      await signInFn();
    } catch (e: any) {
      console.error(`${providerName} sign-in failed`, e);
      return setAuthError(
        `${providerName} login failed. Please try again or use email/password.`
      );
    }

    try {
      await api.get("/auth/me");
      navigate("/", { replace: true });
    } catch (e: any) {
      if (e.response?.status === 404) {
        return navigate("/signup", { replace: true });
      }
      console.error(`Checking /auth/me after ${providerName} failed`, e);
      setAuthError(
        `Could not complete login. Please try again later or use another method.`
      );
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">Log In</h1>

      <button
        onClick={() => handleSocialLogin(loginWithGoogle, "Google")}
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/google.svg" alt="G" className="h-5 w-5 mr-2" />
        Continue with Google
      </button>

      <button
        onClick={() => handleSocialLogin(loginWithApple, "Apple")}
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/apple.svg" alt="" className="h-5 w-5 mr-2" />
        Continue with Apple
      </button>

      <div className="flex items-center">
        <hr className="flex-grow" />
        <span className="px-3 text-gray-500 text-sm">Or</span>
        <hr className="flex-grow" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded px-3 py-2"
          {...register("email", {
            required: "Email is required",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Enter a valid email address",
            },
          })}
        />
        {errors.email && (
          <p className="text-red-500 text-sm">{errors.email.message}</p>
        )}

        <input
          type="password"
          placeholder="Password"
          className="w-full border rounded px-3 py-2"
          {...register("password", {
            required: "Password is required",
            minLength: { value: 8, message: "Must be at least 8 characters" },
            pattern: {
              value: /(?=.*[A-Z])(?=.*\d).+/,
              message: "Password must include an uppercase letter and a number",
            },
          })}
        />
        {errors.password && (
          <p className="text-red-500 text-sm">{errors.password.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          Log in
        </button>

        {authError && (
          <p className="text-red-500 text-center text-sm">{authError}</p>
        )}
      </form>

      <p className="text-center text-sm">
        Don’t have an account?{" "}
        <Link to="/signup" className="text-blue-600 underline">
          Sign up
        </Link>
      </p>
    </div>
  );
};

export default Login;
