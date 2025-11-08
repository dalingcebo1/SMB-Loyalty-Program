// src/features/auth/pages/Signup.tsx

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import api from "../../../api/api";
import "../styles/auth-shared.css";
import HeroText from "../../../components/HeroText";

type FormData = {
  email: string;
  password: string;
};

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [signUpError, setSignUpError] = useState<string>("");

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({ 
    defaultValues: { email: '', password: '' } 
  });

  const onSubmit = async (data: FormData) => {
    setSignUpError("");
    try {
      await api.post("/auth/signup", { email: data.email, password: data.password });
      navigate("/onboarding", { state: { email: data.email, password: data.password } });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setSignUpError(error.response?.data?.detail || error.message || "Failed to sign up. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__body">
          <HeroText
            eyebrow="Create account"
            title="Join ChaosX Loyalty"
            subtitle="Book car wash services, earn rewards, and keep your vehicle spotless with a personalised dashboard."
            align="center"
          />

          {signUpError && (
            <div className="auth-alert auth-alert--error" role="alert">
              {signUpError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="auth-input"
                data-cy="signup-email"
                autoComplete="email"
                {...register("email", { required: "Email is required" })}
              />
              <p className="auth-helper">We’ll never share your email with anyone else.</p>
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Choose a secure password"
                className="auth-input"
                data-cy="signup-password"
                autoComplete="new-password"
                {...register("password", { required: "Password is required" })}
              />
              <p className="auth-helper">Use at least 8 characters with a mix of letters and numbers.</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="auth-button auth-button--primary"
              data-cy="signup-submit"
            >
              {isSubmitting && <span className="auth-loading-spinner" aria-hidden="true"></span>}
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <footer className="auth-footer">
            <span>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">Sign in</Link>
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Signup;
