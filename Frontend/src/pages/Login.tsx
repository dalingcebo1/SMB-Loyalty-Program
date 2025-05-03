// src/pages/Login.tsx

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import {
  signOut,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import { auth } from "../firebase";
import api from "../api/api";

interface FormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  // 1) clear any lingering session & handle redirect result
  useEffect(() => {
    if (auth.currentUser) {
      signOut(auth).catch(console.warn);
    }

    // if we just got redirected back from Google/Apple…
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          try {
            await api.get("/auth/me");
            navigate("/", { replace: true });
          } catch (err: any) {
            if (err.response?.status === 404) {
              setAuthError("Email is not registered. Please sign up first.");
            } else {
              setAuthError("Social login failed. Please try again.");
            }
          }
        }
      })
      .catch((e) => {
        console.error("Redirect login failed", e);
        setAuthError("Social login failed. Please try again.");
      });
  }, [navigate]);

  // Email/password login
  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      await api.post("/auth/login", data);
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err.response?.status === 404) {
        setAuthError("Email is not registered. Please sign up first.");
      } else {
        setAuthError("Email/password login failed.");
      }
    }
  };

  // Social redirect
  const handleSocialLogin = (providerName: "Google" | "Apple") => {
    setAuthError(null);
    let provider =
      providerName === "Google"
        ? new GoogleAuthProvider()
        : new OAuthProvider("apple.com");

    // if Apple not enabled, show friendly
    if (providerName === "Apple") {
      // we let Firebase return 'auth/operation-not-allowed' in the redirect attempt if Apple is not enabled
    }

    signInWithRedirect(auth, provider);
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">Log In</h1>

      <button
        onClick={() => handleSocialLogin("Google")}
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/google.svg" alt="G" className="h-5 w-5 mr-2" />
        Continue with Google
      </button>

      <button
        onClick={() => handleSocialLogin("Apple")}
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
            minLength: { value: 8, message: "Must be at least 8 chars" },
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
