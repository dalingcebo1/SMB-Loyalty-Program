import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from '../../../api/api';
import { auth, getGlobalRecaptcha } from '../../../firebase';
import { signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { confirmationRef } from "../../../utils/confirmationRef";
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from "react-toastify";
import "./OTPVerify.css";
import AuthLayout from "../components/AuthLayout";

declare global {
  interface Window { recaptchaVerifier?: import("firebase/auth").RecaptchaVerifier | null | undefined; }
}

interface LocationState {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone: string;
  subscribe: boolean;
  fromSocialLogin?: boolean;
}

const ONBOARDING_KEY = "onboardingData";

const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || undefined;
  const { loginWithToken } = useAuth();

  const onboardingData = state || (() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      return raw ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  })();

  useEffect(() => { if (state) localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)); }, [state]);

  const confirmation = confirmationRef.current as ConfirmationResult | null;
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!onboardingData) navigate("/signup", { replace: true }); }, [onboardingData, navigate]);
  useEffect(() => {
    if (!confirmation) {
      setError("Session expired. Please restart onboarding.");
      navigate("/onboarding", { replace: true, state: { email: onboardingData?.email, password: onboardingData?.password } });
    }
  }, [confirmation, navigate, onboardingData]);
  useEffect(() => { if (timer <= 0) return; const id = setTimeout(() => setTimer(t => t - 1), 1000); return () => clearTimeout(id); }, [timer]);

  const handleChange = (i: number, v: string) => {
    if (error) setError("");
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...otp];
      if (!next[i] && i > 0) { next[i - 1] = ""; setOtp(next); inputsRef.current[i - 1]?.focus(); }
      else { next[i] = ""; setOtp(next); }
    }
  };

  const submitOTP = async () => {
    setError("");
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    if (!confirmation) { setError("Unable to verify. Please restart onboarding."); return; }
    setLoading(true);
    try {
      await confirmation.confirm(code);
      let backendResponse; let retryCount = 0; const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          backendResponse = await api.post<{ access_token: string }>("/auth/confirm-otp", {
            session_id: confirmation.verificationId,
            code,
            first_name: onboardingData!.firstName,
            last_name: onboardingData!.lastName,
            phone: onboardingData!.phone,
            email: onboardingData!.email,
            tenant_id: "default"
          });
          break;
        } catch (error: unknown) {
          retryCount++;
          if (retryCount >= maxRetries) throw error;
          if (error instanceof Error && (error.message?.includes('Network Error') || (error as any).name === 'AxiosError')) {
            await new Promise(r => setTimeout(r, 1000 * retryCount));
            continue;
          }
          throw error;
        }
      }
      const token = backendResponse!.data.access_token;
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      await loginWithToken(token);
      try {
        await Promise.all([
          api.post("/users", { uid: auth.currentUser!.uid, first_name: onboardingData!.firstName, last_name: onboardingData!.lastName, phone: onboardingData!.phone, subscribe: onboardingData!.subscribe }),
          api.post("/loyalty/register", { first_name: onboardingData!.firstName, last_name: onboardingData!.lastName, phone: onboardingData!.phone, email: onboardingData!.email })
        ]);
      } catch (registrationError: unknown) {
        console.warn("Registration warnings:", registrationError);
        toast.warn("Account created but some features may need setup. Please contact support if issues persist.");
      }
      localStorage.setItem("justOnboarded", "true");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      console.error("OTP confirm failed", err);
      if (err instanceof Error) {
        if (!err.message && ((err as any).name === 'AxiosError' || err.message?.includes('Network Error'))) {
          toast.error("Network error. Please check your connection and try again.");
          setError("Network connection failed. Please check your internet connection and try again."); return;
        }
        if (err.message.includes('auth/invalid-verification-code')) { setError("Invalid verification code. Please try again."); toast.error("Invalid verification code."); return; }
        if (err.message.includes('auth/code-expired')) { setError("Verification code has expired. Please request a new code."); toast.error("Verification code expired."); return; }
      }
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ?? (err as Error)?.message ?? "Verification failed. Please try again.";
      toast.error(msg); setError(msg);
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (timer > 0) return;
    setTimer(60);
    try {
      const verifier = window.recaptchaVerifier || await getGlobalRecaptcha();
      const newConf: ConfirmationResult = await signInWithPhoneNumber(auth, onboardingData!.phone, verifier);
      confirmationRef.current = newConf;
      toast.success("Verification code sent!");
    } catch (error: unknown) {
      console.error("Resend failed:", error); setTimer(0);
      if (error instanceof Error) {
        if (error.message.includes('quota-exceeded')) toast.error("SMS quota exceeded.");
        else if (error.message.includes('invalid-phone-number')) toast.error("Invalid phone number.");
        else if (error.message.includes('too-many-requests')) toast.error("Too many requests.");
        else toast.error("Failed to resend verification code.");
      } else toast.error("Failed to resend verification code.");
    }
  };

  return (
    <AuthLayout
      eyebrow="Phone verification"
      title="Enter Verification Code"
      subtitle="We've sent a 6-digit code to your phone number"
      error={error || null}
      noCard
      containerClassName="otp-container"
    >
      {loading && <div className="loading-overlay"><div className="loading-spinner" /></div>}
      <div className="phone-display">📱 {onboardingData?.phone}</div>
      <div className="otp-inputs" role="group" aria-label="Verification code">
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
            className={`otp-input ${digit ? 'filled' : ''}`}
            disabled={loading}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>
      <div className="otp-actions">
        <button onClick={submitOTP} disabled={loading || otp.join("").length < 6} className="verify-button">
          {loading ? "Verifying..." : "Verify & Complete Setup"}
        </button>
        <div className="resend-section">
          {timer > 0 ? (
            <div className="resend-timer">Didn't receive the code? Resend in 0:{timer.toString().padStart(2, "0")}</div>
          ) : (
            <button onClick={resend} disabled={loading} className="resend-button">Resend Verification Code</button>
          )}
        </div>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); navigate("/onboarding", { state: { email: onboardingData?.email, password: onboardingData?.password, firstName: onboardingData?.firstName, lastName: onboardingData?.lastName } }); }}
          className="back-link"
        >
          ← Change phone number
        </a>
      </div>
    </AuthLayout>
  );
};

export default OTPVerify;

