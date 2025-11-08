// src/features/auth/pages/Signup.tsx

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import api from "../../../api/api";
import "../styles/auth-shared.css";
import AuthLayout from "../components/AuthLayout";
import AuthField from "../components/AuthField";

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
    <AuthLayout
      eyebrow="Create account"
      title="Join ChaosX Loyalty"
      subtitle="Book car wash services, earn rewards, and keep your vehicle spotless with a personalised dashboard."
      error={signUpError || null}
      footer={<span>Already have an account? <Link to="/login" className="auth-link">Sign in</Link></span>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
        <AuthField
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          helper="We’ll never share your email with anyone else."
          error={undefined}
          inputProps={{
            ...register("email", { required: "Email is required" }),
            autoComplete: 'email',
            autoFocus: true,
            // @ts-expect-error custom data attr
            'data-cy': 'signup-email'
          }}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          placeholder="Choose a secure password"
          helper="Use at least 8 characters with a mix of letters and numbers."
          error={undefined}
          inputProps={{
            ...register("password", { required: "Password is required" }),
            autoComplete: 'new-password',
            // @ts-expect-error custom data attr
            'data-cy': 'signup-password'
          }}
        />
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
    </AuthLayout>
  );
};

export default Signup;
