// src/pages/ForgotPassword.tsx
import React, { useState } from "react";
import api from "../api/api";
import { toast } from "react-toastify";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/request-password-reset", { email });
      toast.success("If the email exists, a reset link will be sent.");
    } catch {
      toast.error("Unable to process request. Try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 p-6 bg-white rounded shadow">
      <h1 className="text-xl font-semibold mb-4">Forgot Password</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="Your email"
          className="w-full mb-4 px-3 py-2 border rounded"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </div>
  );
}