import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/api";

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const profile = (state as any) || null;

  // six separate inputs
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (!profile) {
      navigate("/onboarding");
      return;
    }
  }, [profile, navigate]);

  // countdown
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
    if (code.length < 6) return alert("Enter all 6 digits");

    try {
      await api.post("/auth/verify-otp", { phone: profile.phone, code });
      // once verified, submit profile + move to dashboard
      await api.post("/users/create", {
        firstName: profile.firstName,
        lastName:  profile.lastName,
        phone:     profile.phone,
        subscribe: profile.subscribe,
      });
      navigate("/");
    } catch (err: any) {
      alert(err.response?.data?.message || "Invalid OTP");
    }
  };

  const resend = async () => {
    if (timer > 0) return;
    await api.post("/auth/send-otp", { phone: profile.phone });
    setTimer(60);
    setOtp(["", "", "", "", "", ""]);
    inputsRef.current[0]?.focus();
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-8 text-center">
      <h1 className="text-2xl font-semibold">Enter OTP</h1>

      <div className="flex justify-center space-x-2">
        {otp.map((digit, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            ref={(el) => { if (el) inputsRef.current[i] = el; }}
            className="w-10 h-12 text-center border rounded"
          />
        ))}
      </div>

      <p className="text-sm text-gray-600">
        Resend OTP in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
      </p>

      <button
        onClick={resend}
        disabled={timer > 0}
        className="text-blue-600 underline disabled:opacity-50"
      >
        Resend OTP
      </button>

      <button
        onClick={handleSubmit}
        className="mt-4 w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
      >
        Verify
      </button>
    </div>
  );
};

export default OTPVerify;
