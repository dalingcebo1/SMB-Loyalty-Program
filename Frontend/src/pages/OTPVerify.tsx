// src/pages/OTPVerify.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import api from "../api/api";

interface LocationState {
  sessionId:  string;
  firstName:  string;
  lastName:   string;
  phone:      string;
  email:      string;
}

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState };
  const { loginWithToken } = useAuth();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<HTMLInputElement[]>([]);

  // redirect if no sessionId
  useEffect(() => {
    if (!state?.sessionId) {
      navigate("/signup", { replace: true });
    }
  }, [state, navigate]);

  // countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  // handle digit entry
  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  // backspace behavior
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
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

  const handleSubmit = async () => {
    setError(null);
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter all 6 digits");
      return;
    }
    try {
      const res = await api.post<{ token: string }>("/auth/confirm-otp", {
        session_id: state.sessionId,
        code,
        firstName: state.firstName,
        lastName: state.lastName,
      });
      await loginWithToken(res.data.token);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid OTP, please try again.");
    }
  };

  const resend = async () => {
    if (timer > 0) return;
    try {
      await api.post("/auth/send-otp", {
        email: state.email,
        phone: state.phone,
      });
      setTimer(60);
      setOtp(Array(6).fill(""));
      inputsRef.current[0]?.focus();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to resend OTP");
    }
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl mb-4">Enter OTP</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

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
          {timer > 0
            ? `Resend in ${Math.floor(timer / 60)}:${(timer % 60)
                .toString()
                .padStart(2, "0")}`
            : "Resend OTP"}
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
