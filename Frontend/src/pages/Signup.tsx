import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/api";
import PageLayout from "../components/PageLayout";

type FormData = {
  email: string;
  password: string;
};

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [signUpError, setSignUpError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const onEmail = async (data: FormData) => {
    setSignUpError("");
    try {
      // 1) create a pending user
      await api.post("/auth/signup", {
        email: data.email,
        password: data.password,
      });

      // 2) move into onboarding
      navigate("/onboarding", {
        state: { email: data.email, password: data.password },
      });
    } catch (err: any) {
      if (err.response?.status === 400) {
        setSignUpError(
          "That email is already registered. Try logging in instead."
        );
      } else {
        setSignUpError("Unable to sign up right now. Please try again later.");
      }
    }
  };

  return (
    <PageLayout
      loading={isSubmitting}
<<<<<<< HEAD
      error={signUpError}
      onRetry={() => window.location.reload()}
      loadingText="Signing up..."
=======
      error={signUpError || null}
      onRetry={() => window.location.reload()}
      loadingText="Signing up…"
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
    >
      <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
        <h1 className="text-2xl font-semibold text-center">Sign Up</h1>

        <form onSubmit={handleSubmit(onEmail)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Email</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              placeholder="Password"
              className="w-full border rounded px-3 py-2"
              {...register("password", {
                required: "Password is required",
                minLength: { value: 8, message: "Must be at least 8 characters" },
              })}
            />
            {errors.password && (
              <p className="text-red-500 text-sm">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Signing up…" : "Sign Up"}
          </button>

          {signUpError && (
            <p className="text-red-500 text-center text-sm">{signUpError}</p>
          )}
        </form>

<<<<<<< HEAD
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            placeholder="Password"
            className="w-full border rounded px-3 py-2"
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Must be at least 8 characters" },
            })}
          />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Signing up…" : "Sign Up"}
        </button>

        {/* error handled by PageLayout */}
      </form>

      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600 underline">
          Log in
        </Link>
      </p>
=======
        <p className="text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 underline">
            Log in
          </Link>
        </p>
>>>>>>> 2586f56 (Add testing setup and scripts for backend and frontend)
      </div>
    </PageLayout>
  );
};

export default Signup;
