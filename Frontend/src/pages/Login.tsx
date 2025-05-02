// src/pages/Login.tsx

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { signOut, signInWithPopup, signInWithRedirect, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { auth } from "../firebase";
import api from "../api/api";

interface FormData { email: string; password: string; }

const Login: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();

  // Clear session on mount
  useEffect(() => {
    if (auth.currentUser) signOut(auth).catch(console.warn);
  }, []);

  // Email/password login
  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      await api.post("/auth/login", data);         // your backend login endpoint
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err.response?.status === 404) {
        setAuthError("Email is not registered. Please sign up first.");
      } else {
        setAuthError("Email/password login failed.");
      }
    }
  };

  // Social sign-in
  const handleSocialLogin = async (providerName: "Google" | "Apple") => {
    setAuthError(null);
    let provider;
    if (providerName === "Google") provider = new GoogleAuthProvider();
    else provider = new OAuthProvider("apple.com");

    try {
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      // Apple disabled?
      if (providerName === "Apple" && e.code === "auth/operation-not-allowed") {
        return setAuthError("Apple login not enabled. Please use another method.");
      }
      // fallback to redirect if popup blocked
      if (e.code === "auth/operation-not-supported-in-this-environment" || e.code === "auth/popup-blocked") {
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error(`${providerName} sign-in failed`, e);
      return setAuthError(`${providerName} login failed.`);
    }

    // check registration status
    try {
      await api.get("/auth/me");
      navigate("/", { replace: true });
    } catch (e: any) {
      if (e.response?.status === 404) {
        setAuthError("Email is not registered. Please sign up first.");
      } else {
        setAuthError("Social login failed. Please try again.");
      }
    }
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
          {...register("email", { required: true })}
        />
        {errors.email && <p className="text-red-500 text-sm">Email required</p>}

        <input
          type="password"
          placeholder="Password"
          className="w-full border rounded px-3 py-2"
          {...register("password", { required: true })}
        />
        {errors.password && <p className="text-red-500 text-sm">Password required</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          Log in
        </button>

        {authError && <p className="text-red-500 text-center text-sm">{authError}</p>}
      </form>

      <p className="text-center text-sm">
        Don’t have an account?{" "}
        <Link to="/signup" className="text-blue-600 underline">Sign up</Link>
      </p>
    </div>
  );
};

export default Login;
