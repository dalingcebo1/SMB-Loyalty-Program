// src/features/auth/pages/ForgotPassword.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/api";
import { toast } from "react-toastify";
import PageLayout from "../../../components/PageLayout";
import "../styles/auth-shared.css";
import HeroText from "../../../components/HeroText";

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
    <PageLayout
      loading={submitting}
      error={error}
      onRetry={() => window.location.reload()}
      loadingText="Sending reset..."
    >
      <div className="auth-page auth-page--stack">
        <div className="auth-card auth-card--narrow">
          <div className="auth-card__body">
            <HeroText
              eyebrow="Password assistance"
              title="Reset your password"
              subtitle="Enter the email linked to your ChaosX account and we’ll send you a secure reset link."
              as="h1"
              align="left"
            />

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="reset-email" className="auth-label">Email address</label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="auth-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="auth-button auth-button--primary"
              >
                {submitting && <span className="auth-loading-spinner" aria-hidden="true"></span>}
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <footer className="auth-footer">
              <span>
                Remember your password?{' '}
                <Link to="/login" className="auth-link">Return to sign in</Link>
              </span>
            </footer>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
