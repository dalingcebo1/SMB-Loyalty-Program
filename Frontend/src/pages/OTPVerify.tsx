// src/pages/OTPVerify.tsx

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
// Make sure you export `confirmationRef` from your OTP‐init page
import { confirmationRef } from "./Onboarding";

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();

  // If there's no pending SMS confirmation, send them back
  useEffect(() => {
    if (!confirmationRef.current) {
      // No in-flight OTP → they need to start over at signup
      navigate("/signup", { replace: true });
    }
  }, [navigate]);

  // six separate inputs, same as before
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleChange = (idx: number, val: string) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const code = otp.join("");
    if (code.length < 6) {
      return alert("Enter all 6 digits");
    }
    try {
      // 1) Confirm the SMS code with Firebase
      await confirmationRef.current!.confirm(code);

      // 2) Persist the profile in your own backend
      //    (make sure you still pass whatever fields you need here)
      await api.post("/api/users/create", {
        /* firstName, lastName, phone, subscribe, etc */
      });

      // 3) Finally, navigate into the app
      navigate("/", { replace: true });
    } catch (err: any) {
      alert(err.message || "Invalid OTP, please try again.");
    }
  };

  const resend = async () => {
    if (timer > 0) return;
    try {
      await api.post("/api/auth/send-otp", { /* phone: … */ });
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
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
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
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
          Resend OTP in {`${Math.floor(timer / 60)}:${(timer % 60)
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
