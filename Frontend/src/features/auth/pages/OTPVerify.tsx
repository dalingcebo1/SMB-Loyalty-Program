import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from '../../../api/api';
import Loading from '../../../components/Loading';
import ErrorMessage from '../../../components/ErrorMessage';
import { auth, getGlobalRecaptcha } from '../../../firebase';
import { signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { confirmationRef } from "../../../utils/confirmationRef";
import { useAuth } from '../../../auth/AuthProvider';
import { toast } from "react-toastify";
import PageLayout from '../../../components/PageLayout';
import Button from '../../../components/ui/Button';
import Container from '../../../components/ui/Container';

// Extend the Window interface to include recaptchaVerifier
declare global {
  interface Window {
  recaptchaVerifier?: import("firebase/auth").RecaptchaVerifier | null | undefined;
  }
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

  // Fallback to localStorage if state is missing
  const onboardingData = state || (() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  })();

  // Save onboarding data to localStorage if present in state
  useEffect(() => {
    if (state) {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
    }
  }, [state]);

  const confirmation = confirmationRef.current as ConfirmationResult | null;
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If onboardingData is missing, redirect to signup
  useEffect(() => {
    if (!onboardingData) {
      navigate("/signup", { replace: true });
    }
  }, [onboardingData, navigate]);

  // If no ConfirmationResult, bounce back
  useEffect(() => {
    if (!confirmation) {
      setError("Session expired. Please restart onboarding.");
      navigate("/onboarding", {
        replace: true,
        state: { email: onboardingData?.email, password: onboardingData?.password },
      });
    }
  }, [confirmation, navigate, onboardingData]);

  // Countdown until resend
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleChange = (i: number, v: string) => {
    if (error) setError("");
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v;
    setOtp(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };

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

  if (loading) return <Loading text="Verifying OTP..." />;
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  const submitOTP = async () => {
    setError("");
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    if (!confirmation) { setError("Unable to verify. Please restart onboarding."); return; }

    setLoading(true);
    try {
      // First verify OTP with Firebase
      await confirmation.confirm(code);
      
      // Then exchange for backend JWT with retry logic
      let backendResponse;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          backendResponse = await api.post<{ access_token: string }>(
            "/auth/confirm-otp",
            { session_id: confirmation.verificationId, code, first_name: onboardingData!.firstName, last_name: onboardingData!.lastName, phone: onboardingData!.phone, email: onboardingData!.email, tenant_id: "default" }
          );
          break; // Success, exit retry loop
        } catch (error: unknown) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error; // Re-throw after max retries
          }
          if (error instanceof Error && (error.message?.includes('Network Error') || error.name === 'AxiosError')) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            continue;
          }
          throw error; // Non-network error, don't retry
        }
      }
      
      const token = backendResponse!.data.access_token;
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      await loginWithToken(token);
      
      // Complete registration with additional retry for network issues
      try {
        await Promise.all([
          api.post("/users", { uid: auth.currentUser!.uid, first_name: onboardingData!.firstName, last_name: onboardingData!.lastName, phone: onboardingData!.phone, subscribe: onboardingData!.subscribe }),
          api.post("/loyalty/register", { first_name: onboardingData!.firstName, last_name: onboardingData!.lastName, phone: onboardingData!.phone, email: onboardingData!.email })
        ]);
      } catch (registrationError: unknown) {
        // Log but don't fail the entire process for registration errors
        console.warn("Registration warnings:", registrationError);
        toast.warn("Account created but some features may need setup. Please contact support if issues persist.");
      }
      
      localStorage.setItem("justOnboarded", "true");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      console.error("OTP confirm failed", err);
      
      // Enhanced error handling for different types of failures
      if (err instanceof Error) {
        if (!err.message && (err.name === 'AxiosError' || err.message?.includes('Network Error'))) {
          toast.error("Network error. Please check your connection and try again.");
          setError("Network connection failed. Please check your internet connection and try again.");
          return;
        }
        
        if (err.message.includes('auth/invalid-verification-code')) {
          setError("Invalid verification code. Please check the code and try again.");
          toast.error("Invalid verification code. Please check the code and try again.");
          return;
        }
        
        if (err.message.includes('auth/code-expired')) {
          setError("Verification code has expired. Please request a new code.");
          toast.error("Verification code has expired. Please request a new code.");
          return;
        }
      }
      
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ?? 
                  (err as Error)?.message ?? 
                  "Verification failed. Please try again.";
      toast.error(msg); 
      setError(msg);
    } finally { 
      setLoading(false); 
    }
  };

  const resend = async () => {
    if (timer > 0) return;
    
    setTimer(60); // Reset timer immediately to prevent multiple clicks
    
    try {
      // Rebuild verifier if missing (HMR may have cleared DOM)
  const verifier = window.recaptchaVerifier || await getGlobalRecaptcha();
  const newConf: ConfirmationResult = await signInWithPhoneNumber(auth, onboardingData!.phone, verifier);
      confirmationRef.current = newConf;
      toast.success("Verification code sent!");
    } catch (error: unknown) {
      console.error("Resend failed:", error);
      setTimer(0); // Reset timer on failure
      
      if (error instanceof Error) {
        if (error.message.includes('quota-exceeded')) {
          toast.error("SMS quota exceeded. Please try again later.");
        } else if (error.message.includes('invalid-phone-number')) {
          toast.error("Invalid phone number. Please restart onboarding.");
        } else if (error.message.includes('too-many-requests')) {
          toast.error("Too many requests. Please wait before requesting another code.");
        } else {
          toast.error("Failed to resend verification code. Please try again.");
        }
      } else {
        toast.error("Failed to resend verification code. Please try again.");
      }
    }
  };

  return (
    <PageLayout loading={loading} error={error || undefined}>
      <Container>
        <div className="max-w-sm mx-auto p-6">
          <h1 className="text-xl font-semibold mb-4">Enter Verification Code</h1>
          <div className="flex space-x-2 mb-6">
            {otp.map((d, i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(e, i)}
                ref={el => { if (el) inputsRef.current[i] = el; }}
                className="w-10 h-12 text-center border rounded"
                disabled={loading}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={resend} disabled={timer > 0 || loading} className="underline">
              {timer > 0 ? `Resend in 0:${timer.toString().padStart(2, "0")}` : "Resend Code"}
            </Button>
            <Button variant="primary" onClick={submitOTP} disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </div>
      </Container>
    </PageLayout>
  );
};

export default OTPVerify;

