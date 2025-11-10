// src/features/auth/pages/ResetPassword.tsx
import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../../../api/api";
import { notifySuccessKey, notifyErrorKey } from "../../../utils/notifications";
import PageLayout from "../../../components/PageLayout";
import "../styles/auth-shared.css";
import HeroText from "../../../components/HeroText";

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
  notifySuccessKey('notifications.password.reset.success');
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
  const msg = error.response?.data?.detail || "Reset failed.";
  notifyErrorKey('notifications.password.reset.failed');
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
      loadingText="Resetting password..."
    >
      <div className="auth-page auth-page--stack">
        <div className="auth-card auth-card--narrow">
          <div className="auth-card__body">
            <HeroText
              eyebrow="Secure update"
              title="Choose a new password"
              subtitle="Pick a strong password to protect your account. You’ll be redirected to sign in once we confirm the change."
              as="h1"
              align="left"
            />

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="new-password" className="auth-label">New password</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  placeholder="Enter a new password"
                  className="auth-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="auth-button auth-button--primary"
              >
                {submitting && <span className="auth-loading-spinner" aria-hidden="true"></span>}
                {submitting ? "Resetting…" : "Reset password"}
              </button>
            </form>

            <footer className="auth-footer">
              <Link to="/login" className="auth-link">Back to login</Link>
            </footer>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
