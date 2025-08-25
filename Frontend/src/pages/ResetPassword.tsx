// src/pages/ResetPassword.tsx
import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import { toast } from "react-toastify";
import PageLayout from "../components/PageLayout";

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
    <PageLayout
      loading={submitting}
      error={error}
      onRetry={() => window.location.reload()}
      loadingText="Resetting password..."
    >
      <div className="max-w-sm mx-auto mt-10 p-6 bg-white rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Reset Password</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            required
            placeholder="New password"
            className="w-full mb-4 px-3 py-2 border rounded"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </PageLayout>
  );
}

// This file has been moved to src/features/auth/pages/ResetPassword.tsx