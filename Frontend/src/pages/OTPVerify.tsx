import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation }       from "react-router-dom";
import api                              from "../api/api";
import { auth }                         from "../firebase";
import { confirmationRef }              from "./Onboarding";

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

  // if we never got a ConfirmationResult, go back one step
  useEffect(() => {
    if (!confirmation) {
      navigate("/onboarding", {
        replace: true,
        state: { email: state?.email, password: state?.password },
      });
    }
  }, [confirmation, navigate, state]);

  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [otp,   setOtp]   = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) inputsRef.current[i+1]?.focus();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    i: number
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...otp];
      if (next[i]==="") {
        if (i>0) {
          next[i-1] = "";
          setOtp(next);
          inputsRef.current[i-1]?.focus();
        }
      } else {
        next[i] = "";
        setOtp(next);
      }
    }
  };

  const submitOTP = async () => {
    if (!confirmation) return;
    const code = otp.join("");
    if (code.length < 6) {
      alert("Enter all 6 digits");
      return;
    }

    try {
      await confirmation.confirm(code);
      // now persist on your backend
      await api.post("/users", {
        uid:       auth.currentUser!.uid,
        firstName: state!.firstName,
        lastName:  state!.lastName,
        phone:     state!.phone,
        subscribe: state!.subscribe,
      });
      navigate("/", { replace: true });
    } catch (err: any) {
      alert(err.message || "Invalid OTP, please try again.");
    }
  };

  const resend = () => {
    if (timer>0) return;
    navigate("/onboarding", {
      state: { email: state!.email, password: state!.password },
    });
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-xl mb-4">Enter OTP</h1>

      <div className="flex space-x-2 mb-4">
        {otp.map((d,i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e)=>handleChange(i,e.target.value)}
            onKeyDown={(e)=>handleKeyDown(e,i)}
            ref={el => { if (el) inputsRef.current[i] = el; }}
            className="w-10 h-12 text-center border rounded"
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={resend}
          disabled={timer>0}
          className="text-blue-600 underline disabled:opacity-50"
        >
          Resend in {`${Math.floor(timer/60)}:${(timer%60).toString().padStart(2,'0')}`}
        </button>

        <button
          onClick={submitOTP}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Verify
        </button>
      </div>
    </div>
  );
};

export default OTPVerify;
