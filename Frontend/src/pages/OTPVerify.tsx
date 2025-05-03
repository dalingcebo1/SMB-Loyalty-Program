// src/pages/OTPVerify.tsx

import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

interface LocationState {
  sessionId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState };
  const { loginWithToken } = useAuth();

  // sessionId in local state so we can update on resend
  const [sessionId, setSessionId] = useState(state?.sessionId);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const inputsRef = useRef<HTMLInputElement[]>([]);

  // Redirect back if no sessionId
  useEffect(() => {
    if (!sessionId) {
      navigate("/signup", { replace: true });
    }
  }, [sessionId, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  // Handle OTP digit entry
  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  // Handle backspace for intuitive navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...otp];
      if (next[idx] === "") {
        if (idx > 0) {
          next[idx - 1] = "";
          setOtp(next);
          inputsRef.current[idx - 1]?.focus();
        }
      } else {
        next[idx] = "";
        setOtp(next);
      }
    }
  };

  // Submit OTP code
  const handleSubmit = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      alert("Enter all 6 digits");
      return;
    }
    try {
      const res = await api.post<{ token: string }>("/auth/confirm-otp", {
        session_id: sessionId,
        code,
        firstName: state.firstName,
        lastName: state.lastName,
      });

      // Use context helper to set token & fetch user
      await loginWithToken(res.data.token);

      // Navigate into the app
      navigate("/", { replace: true });
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Invalid OTP");
    }
  };

  // Resend OTP
  const resend = async () => {
    if (timer > 0) return;
    try {
      const res = await api.post<{ session_id: string }>("/auth/send-otp", {
        email: state.email,
        phone: state.phone,
      });
      setSessionId(res.data.session_id);
      setTimer(60);
      setOtp(Array(6).fill(""));
      inputsRef.current[0]?.focus();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to resend OTP");
    }
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl mb-4">Enter OTP</h1>

      <div className="flex space-x-2 mb-4">
        {otp.map((digit, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            ref={(el) => {
              if (el) inputsRef.current[i] = el;
            }}
            className="w-10 h-12 text-center border rounded"
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={resend}
          disabled={timer > 0}
          className="text-blue-600 underline disabled:opacity-50"
        >
          Resend in {`${Math.floor(timer / 60)}:${(timer % 60)
            .toString()
            .padStart(2, "0")}`}
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Verify
        </button>
      </div>
    </div>
  );
};

export default OTPVerify;
