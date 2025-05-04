// src/pages/OTPVerify.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { auth } from "../firebase";
import { confirmationRef } from "./Onboarding";

interface LocationState {
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
  phone:     string;
  subscribe: boolean;
}

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: LocationState };
  const confirmation = confirmationRef.current;

  // Local UI state
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if no confirmation
  useEffect(() => {
    if (!confirmation) {
      setError("Session expired. Please restart onboarding.");
      navigate("/onboarding", {
        replace: true,
        state: { email: state?.email, password: state?.password },
      });
    }
  }, [confirmation, navigate, state]);

  // Countdown timer for resend
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  // Handle digit input
  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };

  // Handle backspace navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...otp];
      if (!next[i] && i > 0) {
        next[i - 1] = "";
        setOtp(next);
        inputsRef.current[i - 1]?.focus();
      } else {
        next[i] = "";
        setOtp(next);
      }
    }
  };

  // Submit OTP code
  const submitOTP = async () => {
    setError("");
    const code = otp.join("");

    if (code.length < 6) {
      setError("Please enter all 6 digits of the OTP.");
      return;
    }

    if (!confirmation) {
      setError("Unable to verify OTP. Please restart onboarding.");
      return;
    }

    setLoading(true);
    try {
      await confirmation.confirm(code);
      // Persist user data
      await api.post("/users", {
        uid:       auth.currentUser!.uid,
        firstName: state!.firstName,
        lastName:  state!.lastName,
        phone:     state!.phone,
        subscribe: state!.subscribe,
      });
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("OTP confirm failed", err);
      setError(err.message || "Invalid OTP, please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP (restart flow)
  const resend = () => {
    if (timer > 0) return;
    navigate("/onboarding", {
      state: { email: state!.email, password: state!.password },
    });
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl font-semibold mb-4">Enter Verification Code</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="flex space-x-2 mb-6">
        {otp.map((digit, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            ref={el => { if (el) inputsRef.current[i] = el; }}
            className="w-10 h-12 text-center border rounded"
            disabled={loading}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={resend}
          disabled={timer > 0 || loading}
          className="text-blue-600 underline disabled:opacity-50"
        >
          {timer > 0 ? `Resend in 0:${timer.toString().padStart(2, '0')}` : 'Resend Code'}
        </button>
        <button
          onClick={submitOTP}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  );
};

export default OTPVerify;
