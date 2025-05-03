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
  const { loginWithToken } = useAuth();
  const { state } = useLocation() as { state: LocationState };

  // Guard: if someone lands here without a sessionId, bounce them back
  useEffect(() => {
    if (!state?.sessionId) {
      navigate("/signup", { replace: true });
    }
  }, [state, navigate]);

  const [sessionId, setSessionId] = useState(state?.sessionId ?? "");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const inputsRef = useRef<HTMLInputElement[]>([]);

  // countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  // handle digit change + auto-focus next
  const onChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  // backspace behaviour
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[idx] === "") {
        if (idx > 0) {
          next[idx - 1] = "";
          setDigits(next);
          inputsRef.current[idx - 1]?.focus();
        }
      } else {
        next[idx] = "";
        setDigits(next);
      }
    }
  };

  // submit OTP
  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits");
      return;
    }
    setError(null);

    try {
      const res = await api.post<{ access_token: string }>(
        "/auth/confirm-otp",
        {
          session_id: sessionId,
          code,
          first_name: state.firstName,
          last_name: state.lastName,
        }
      );
      // login with returned JWT
      await loginWithToken(res.data.access_token);
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError("Invalid or expired code. Please try again.");
      } else {
        setError("Failed to verify OTP. Please try again later.");
      }
    }
  };

  // resend code
  const handleResend = async () => {
    if (timer > 0) return;
    setError(null);
    try {
      const res = await api.post<{ session_id: string }>("/auth/send-otp", {
        email: state.email,
        phone: state.phone,
      });
      setSessionId(res.data.session_id);
      setDigits(Array(6).fill(""));
      inputsRef.current[0]?.focus();
      setTimer(60);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Unable to resend OTP. Please try again later."
      );
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h2 className="text-xl font-semibold text-center">Enter OTP</h2>

      <div className="flex justify-center space-x-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => el && (inputsRef.current[i] = el)}
            className="w-10 h-12 text-center border rounded"
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-center">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          onClick={handleResend}
          disabled={timer > 0}
          className="text-blue-600 underline disabled:opacity-50"
        >
          {timer > 0
            ? `Resend in ${Math.floor(timer / 60)}:${(timer % 60)
                .toString()
                .padStart(2, "0")}`
            : "Resend code"}
        </button>

        <button
          onClick={handleVerify}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Verify & Finish
        </button>
      </div>
    </div>
  );
};

export default OTPVerify;
