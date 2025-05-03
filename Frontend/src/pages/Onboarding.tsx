// src/pages/Onboarding.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

interface LocationState {
  email: string;
  password: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
}

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState };
  const { signup } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  // If we don’t have email/password, go back to signup
  useEffect(() => {
    if (!state?.email || !state?.password) {
      navigate("/signup", { replace: true });
    }
  }, [state, navigate]);

  const onSubmit = async (data: FormData) => {
    setError(null);

    try {
      // 1) create pending user
      await signup(state.email, state.password);

      // 2) send OTP
      const res = await api.post<{ session_id: string }>("/auth/send-otp", {
        email: state.email,
        phone: data.phone,
      });

      // 3) navigate to OTP verification
      navigate("/onboarding/verify", {
        state: {
          sessionId: res.data.session_id,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: state.email,
        },
      });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to send OTP. Please try again.";
      setError(msg);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Complete Your Onboarding</h2>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">
            First Name
          </label>
          <input
            id="firstName"
            {...register("firstName", {
              required: "First name is required",
            })}
            className="mt-1 block w-full border border-gray-300 rounded p-2"
          />
          {errors.firstName && (
            <p className="text-red-500 text-sm mt-1">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last Name
          </label>
          <input
            id="lastName"
            {...register("lastName", {
              required: "Last name is required",
            })}
            className="mt-1 block w-full border border-gray-300 rounded p-2"
          />
          {errors.lastName && (
            <p className="text-red-500 text-sm mt-1">
              {errors.lastName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            {...register("phone", {
              required: "Phone number is required",
              pattern: {
                value: /^\+\d{1,3}\s?\d{4,}$/,
                message: "Enter a valid international phone number",
              },
            })}
            placeholder="+1 5550123456"
            className="mt-1 block w-full border border-gray-300 rounded p-2"
          />
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">
              {errors.phone.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Sending OTP…" : "Send OTP"}
        </button>
      </form>
    </div>
  );
};

export default Onboarding;
