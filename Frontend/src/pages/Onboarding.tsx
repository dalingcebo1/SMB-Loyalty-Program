// src/pages/Onboarding.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import api from "../api/api";

interface LocationState {
  email: string;
  password: string;
}

interface FormData {
  first_name: string;
  last_name: string;
  phone: string;
}

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState };
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  // Guard
  useEffect(() => {
    if (!state?.email || !state?.password) {
      navigate("/signup", { replace: true });
    }
  }, [state, navigate]);

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      // Only send OTP here
      const res = await api.post<{ session_id: string }>("/auth/send-otp", {
        email: state.email,
        phone: data.phone,
      });
      navigate("/onboarding/verify", {
        state: {
          email: state.email,
          password: state.password,
          first_name: data.first_name,
          last_name: data.last_name,
          session_id: res.data.session_id,
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to send OTP. Please try again.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Finish Onboarding</h2>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* First Name */}
        <input
          {...register("first_name", { required: "Required" })}
          placeholder="First name"
          className="w-full border rounded px-3 py-2"
        />
        {errors.first_name && <p className="text-red-500 text-sm">{errors.first_name.message}</p>}

        {/* Last Name */}
        <input
          {...register("last_name", { required: "Required" })}
          placeholder="Last name"
          className="w-full border rounded px-3 py-2"
        />
        {errors.last_name && <p className="text-red-500 text-sm">{errors.last_name.message}</p>}

        {/* Phone */}
        <input
          {...register("phone", {
            required: "Required",
            pattern: { value: /^\+\d+$/, message: "Use +<countrycode><number>" }
          })}
          placeholder="+1234567890"
          className="w-full border rounded px-3 py-2"
        />
        {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Send OTP
        </button>
      </form>
    </div>
  );
};

export default Onboarding;
