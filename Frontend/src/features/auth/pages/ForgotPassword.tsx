// src/features/auth/pages/ForgotPassword.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/api";
import { toast } from "react-toastify";
import "../styles/auth-shared.css";
import AuthLayout from "../components/AuthLayout";
import AuthField from "../components/AuthField";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/request-password-reset", { email });
      toast.success("If the email exists, a reset link will be sent.");
    } catch {
      const msg = "Unable to process request. Try again later.";
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <AuthLayout
      eyebrow="Password assistance"
      title="Reset your password"
      subtitle="Enter the email linked to your ChaosX account and we’ll send you a secure reset link."
      error={error}
      footer={<span>Remember your password? <Link to="/login" className="auth-link">Return to sign in</Link></span>}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <AuthField
          id="reset-email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          error={undefined}
          inputProps={{
            required: true,
            value: email,
            onChange: e => setEmail(e.target.value),
            autoComplete: 'email',
            autoFocus: true
          }}
        />
        <button
          type="submit"
          disabled={submitting}
          className="auth-button auth-button--primary"
        >
          {submitting && <span className="auth-loading-spinner" aria-hidden="true"></span>}
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthLayout>
  );
}
