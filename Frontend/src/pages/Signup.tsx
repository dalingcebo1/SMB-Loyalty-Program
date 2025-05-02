import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

interface FormData {
  email: string;
  password: string;
}

const Signup: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const { loginWithGoogle, loginWithApple, signupWithEmail } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      await signupWithEmail(data.email, data.password);
      navigate("/onboarding");
    } catch (err: any) {
      // Handle Firebase signup errors
      switch (err.code) {
        case "auth/email-already-in-use":
          setAuthError("That email address is already registered.");
          break;
        case "auth/weak-password":
          setAuthError("Password is too weak. Please choose a stronger one.");
          break;
        default:
          setAuthError(err.message || "Signup failed. Please try again.");
      }
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">
        Welcome to Sparkle Car Wash
      </h1>

      <button
        onClick={() =>
          loginWithGoogle().then(() => navigate("/onboarding"))
        }
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/google.svg" alt="G" className="h-5 w-5 mr-2" />
        Continue with Google
      </button>

      <button
        onClick={() =>
          loginWithApple().then(() => navigate("/onboarding"))
        }
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/apple.svg" alt="" className="h-5 w-5 mr-2" />
        Continue with Apple
      </button>

      <div className="flex items-center">
        <hr className="flex-grow" />
        <span className="px-3 text-gray-500 text-sm">
          Or sign up with email
        </span>
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
            minLength: {
              value: 8,
              message: "Password must be at least 8 characters",
            },
            pattern: {
              value: /(?=.*[A-Z])(?=.*\d).+/,
              message:
                "Password must include an uppercase letter and a number",
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

        {authError && (
          <p className="text-red-500 text-center text-sm">{authError}</p>
        )}
      </form>

      <div className="text-center text-sm">
        <Link to="/reset-password" className="text-blue-600 underline">
          Forgot password?
        </Link>
      </div>

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
