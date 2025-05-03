// src/pages/OTPVerify.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../auth/AuthProvider";

interface LocationState {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  session_id: string;
}

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState };
  const [otp, setOtp] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { loginWithToken } = useAuth();

  useEffect(() => {
    if (!state?.session_id) {
      navigate("/signup", { replace: true });
    }
  }, [state, navigate]);

  const handleSubmit = async () => {
    setError(null);
    try {
      // 1) Create the user record
      await api.post("/auth/signup", {
        email: state.email,
        password: state.password,
      });

      // 2) Confirm OTP & get token
      const res = await api.post<{ access_token: string }>("/auth/confirm-otp", {
        session_id: state.session_id,
        code: otp,
        first_name: state.first_name,
        last_name: state.last_name,
      });

      // 3) Log in with token & go
      await loginWithToken(res.data.access_token);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid or expired OTP");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">Enter OTP</h1>

      <input
        type="text"
        maxLength={6}
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
        className="w-full border rounded px-3 py-2 text-center text-lg"
        placeholder="123456"
      />

      <button
        onClick={handleSubmit}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
      >
        Verify & Finish
      </button>

      {error && <p className="text-red-500 text-center">{error}</p>}
    </div>
  );
};

export default OTPVerify;
