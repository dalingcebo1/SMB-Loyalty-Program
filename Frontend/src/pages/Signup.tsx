// src/pages/Signup.tsx

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "../auth/AuthProvider";

type FormData = { email: string; password: string };

const Signup: React.FC = () => {
  const { loginWithGoogle, loginWithApple } = useAuth();
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

  // Handle email-password flow: hand off to onboarding
  const onEmail = (data: FormData) => {
    navigate("/onboarding", {
      state: { mode: "email", email: data.email, password: data.password },
    });
  };

  // Social sign-up
  const handleSocial = async (provider: "google" | "apple") => {
    try {
      if (provider === "google") {
        await loginWithGoogle();
      } else {
        await loginWithApple();
      }
      navigate("/onboarding", { state: { mode: provider } });
    } catch (err) {
      console.error(`${provider} signup failed`, err);
      // you can set an error state here if you want to show UI feedback
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">
        Welcome to Sparkle Car Wash
      </h1>

      <button
        onClick={() => handleSocial("google")}
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/google.svg" alt="G" className="h-5 w-5 mr-2" />
        Continue with Google
      </button>

      <button
        onClick={() => handleSocial("apple")}
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/apple.svg" alt="" className="h-5 w-5 mr-2" />
        Continue with Apple
      </button>

      <div className="flex items-center">
        <hr className="flex-grow" />
        <span className="px-3 text-gray-500 text-sm">Or sign up with email</span>
        <hr className="flex-grow" />
      </div>

      <form onSubmit={handleSubmit(onEmail)} className="space-y-4">
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
            minLength: { value: 8, message: "Must be 8+ chars" },
            pattern: {
              value: /(?=.*[A-Z])(?=.*\d).+/,
              message: "Need uppercase + number",
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
          {isSubmitting ? "Signing up…" : "Sign up"}
        </button>
      </form>

      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600 underline">
          Log in
        </Link>
      </p>
    </div>
  );
};

export default Signup;
