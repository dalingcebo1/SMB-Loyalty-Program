// src/pages/Login.tsx

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

interface FormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // track any auth error & the last credentials we tried
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastCreds, setLastCreds] = useState<FormData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  useEffect(() => {
    setAuthError(null);
  }, []);

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      await login(data.email, data.password);
      navigate("/", { replace: true });
    } catch (err: any) {
      // save what they just tried, so we can re-use it
      setLastCreds(data);

      if (err.response?.status === 404) {
        setAuthError("Email is not registered. Please sign up first.");
      } else if (err.response?.status === 401) {
        setAuthError("Incorrect email or password.");
      } else if (err.response?.status === 403) {
        setAuthError("Please complete onboarding before logging in.");
      } else {
        setAuthError("Unable to log in right now. Please try again later.");
      }
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">Log In</h1>

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
          {...register("password", { required: "Password is required" })}
        />
        {errors.password && (
          <p className="text-red-500 text-sm">{errors.password.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      {authError && (
        <div className="text-center space-y-2">
          <p className="text-red-500 text-sm">{authError}</p>
          {/** If they just hit the 403 case, let them jump back to onboarding */}
          {authError.includes("onboarding") && lastCreds && (
            <button
              onClick={() =>
                navigate("/onboarding", {
                  state: {
                    email: lastCreds.email,
                    password: lastCreds.password,
                  },
                })
              }
              className="text-blue-600 underline text-sm"
            >
              Complete onboarding →
            </button>
          )}
        </div>
      )}

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
