// src/pages/OTPVerify.tsx

import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import api from "../api/api";
// confirmationRef is set in Onboarding.tsx when signInWithPhoneNumber succeeds
import { confirmationRef } from "./Onboarding";

interface LocationState {
  firstName: string;
  lastName: string;
  phone: string;
  subscribe: boolean;
}

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState };

  // If there's no pending SMS confirmation, send them back to signup
  useEffect(() => {
    if (!confirmationRef.current) {
      navigate("/signup", { replace: true });
    }
  }, [navigate]);

  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  // Handle digit entry and auto-advance
  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  // Handle backspace navigation & deletion
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...otp];
      if (next[idx] === "") {
        // move to previous and clear it
        if (idx > 0) {
          next[idx - 1] = "";
          setOtp(next);
          inputsRef.current[idx - 1]?.focus();
        }
      } else {
        // clear current
        next[idx] = "";
        setOtp(next);
      }
    }
  };

  // Verify OTP and submit profile
  const handleSubmit = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      alert("Enter all 6 digits");
      return;
    }
    try {
      // 1) Confirm with Firebase
      await confirmationRef.current!.confirm(code);

      // 2) Persist profile to your backend
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user.");

      await api.post("/users", {
        uid: user.uid,
        firstName: state.firstName,
        lastName: state.lastName,
        phone: state.phone,
        subscribe: state.subscribe,
      });

      // 3) Enter the app
      navigate("/", { replace: true });
    } catch (err: any) {
      alert(err.message || "Invalid OTP, please try again.");
    }
  };

  // Resend OTP
  const resend = async () => {
    if (timer > 0) return;
    try {
      await api.post("/auth/send-otp", { phone: state.phone });
      setTimer(60);
      setOtp(Array(6).fill(""));
      inputsRef.current[0]?.focus();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to resend OTP");
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
