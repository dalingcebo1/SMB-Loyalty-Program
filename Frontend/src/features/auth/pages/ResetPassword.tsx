// src/features/auth/pages/ResetPassword.tsx
import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../../../api/api";
import { toast } from "react-toastify";
import "../styles/auth-shared.css";
import AuthLayout from "../components/AuthLayout";
import AuthField from "../components/AuthField";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = params.get("token") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/reset-password-confirm", { token, new_password: password });
      toast.success("Password reset successful! You can now log in.");
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      const msg = error.response?.data?.detail || "Reset failed.";
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Secure update"
      title="Choose a new password"
      subtitle="Pick a strong password to protect your account. You’ll be redirected to sign in once we confirm the change."
      error={error}
      footer={<Link to="/login" className="auth-link">Back to login</Link>}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <AuthField
          id="new-password"
            label="New password"
            type="password"
            placeholder="Enter a new password"
            error={undefined}
            inputProps={{
              required: true,
              value: password,
              onChange: e => setPassword(e.target.value),
              autoComplete: 'new-password',
              autoFocus: true
            }}
        />
        <button
          type="submit"
          disabled={submitting}
          className="auth-button auth-button--primary"
        >
          {submitting && <span className="auth-loading-spinner" aria-hidden="true"></span>}
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>
    </AuthLayout>
  );
}
