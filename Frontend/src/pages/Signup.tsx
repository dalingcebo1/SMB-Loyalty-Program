// src/pages/Signup.tsx
import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

interface FormData {
  email: string;
  password: string;
}

const Signup: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithApple,
    signupWithEmail,
  } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await signupWithEmail(data.email, data.password);
      navigate("/");
    } catch (err: any) {
      // handle and surface Firebase errors
      alert(err.message || "Signup failed");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">
        Welcome to Sparkle Car Wash
      </h1>

      {/* Social sign-up */}
      <button
        onClick={() => loginWithGoogle().then(() => navigate("/"))}
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/google.svg" alt="G" className="h-5 w-5 mr-2" />
        Continue with Google
      </button>

      <button
        onClick={() => loginWithApple().then(() => navigate("/"))}
        className="w-full flex items-center justify-center border rounded px-4 py-2 hover:bg-gray-100"
      >
        <img src="/icons/apple.svg" alt="" className="h-5 w-5 mr-2" />
        Continue with Apple
      </button>

      {/* Divider */}
      <div className="flex items-center">
        <hr className="flex-grow" />
        <span className="px-3 text-gray-500 text-sm">Or sign up with email</span>
        <hr className="flex-grow" />
      </div>

      {/* Email/password form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded px-3 py-2"
          {...register("email", { required: "Email is required" })}
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
              value: 6,
              message: "Password must be at least 6 characters",
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

      {/* Footer link */}
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
