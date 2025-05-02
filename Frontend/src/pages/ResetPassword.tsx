import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate, Link } from "react-router-dom";

interface FormData {
  email: string;
}

const ResetPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  async function onSubmit(data: FormData) {
        try {
            await resetPassword(data.email);
            setStatus("A password reset email has been sent.");
        } catch (err: any) {
            setStatus(err.message || "Failed to send reset email.");
        }
    }

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">Reset Password</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full border rounded px-3 py-2"
          {...register("email", {
            required: "Email is required",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Enter a valid email address",
            },
          })}
        />
        {errors.email && (
          <p className="text-red-500 text-sm">{errors.email.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Sending…" : "Send Reset Link"}
        </button>
      </form>

      {status && (
        <p className="text-center text-sm mt-4 text-gray-700">{status}</p>
      )}

      <p className="text-center text-sm">
        <Link to="/login" className="text-blue-600 underline">
          Back to Log in
        </Link>
      </p>
    </div>
  );
};

export default ResetPassword;
