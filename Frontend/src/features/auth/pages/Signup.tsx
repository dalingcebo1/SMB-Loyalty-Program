// src/features/auth/pages/Signup.tsx

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import api from "../../../api/api";
import './Signup.css';

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
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <h1 className="signup-title">Create Account</h1>
          <p className="signup-subtitle">Join us to get started with your car wash experience</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="signup-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              className="form-input"
              {...register("email", { required: "Email is required" })}
            />
            <div className="form-helper">We'll never share your email.</div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Create a password"
              className="form-input"
              {...register("password", { required: "Password is required" })}
            />
            <div className="form-helper">At least 8 characters.</div>
          </div>

          <button type="submit" disabled={isSubmitting} className="signup-button">
            {isSubmitting && <span className="loading-spinner"></span>}
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        {signUpError && (
          <div className="error-message">
            {signUpError}
          </div>
        )}

        <div className="login-link">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
