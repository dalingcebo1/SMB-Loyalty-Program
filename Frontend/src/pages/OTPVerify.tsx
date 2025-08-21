// src/pages/OTPVerify.tsx


import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation }           from "react-router-dom";
import api                                    from "../api/api";
import Loading                                from "../components/Loading";
import ErrorMessage                           from "../components/ErrorMessage";
import { auth }                               from "../firebase";
import { signInWithPhoneNumber }              from "firebase/auth";
import { confirmationRef }                    from "./Onboarding";
import { useAuth }                            from "../auth/AuthProvider";  // ← fix path
import { toast }                              from "react-toastify";
import PageLayout                             from "../components/PageLayout";
import Button                                  from "../components/ui/Button";
import Container                               from "../components/ui/Container";


// Extend the Window interface to include recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}


interface LocationState {
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
  phone:     string;
  subscribe: boolean;
}


const ONBOARDING_KEY = "onboardingData";


const OTPVerify: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: LocationState };
  const { loginWithToken } = useAuth();


  // Fallback to localStorage if state is missing
  const onboardingData: LocationState | undefined = state || (() => {
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


  const confirmation = confirmationRef.current;
  const inputsRef    = useRef<HTMLInputElement[]>([]);
  const [otp,     setOtp]     = useState<string[]>(Array(6).fill(""));
  const [timer,   setTimer]   = useState(60);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);


  // If onboardingData is missing, redirect to signup
  useEffect(() => {
    if (!onboardingData) {
      navigate("/signup", { replace: true });
    }
  }, [onboardingData, navigate]);


  // If we never got a ConfirmationResult, bounce back
  useEffect(() => {
    if (!confirmation) {
      setError("Session expired. Please restart onboarding.");
      navigate("/onboarding", {
        replace: true,
        state: { email: onboardingData?.email, password: onboardingData?.password },
      });
    }
  }, [confirmation, navigate, onboardingData]);


  // Countdown until Resend
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);


  // Handle each digit input
  const handleChange = (i: number, v: string) => {
    if (error) setError("");
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };


  // Backspace navigation
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


  // Show loading UI during OTP verification
  if (loading) return <Loading text="Verifying OTP..." />;
  // Show error UI
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  // Verify & finalize
  const submitOTP = async () => {
    setError("");
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    if (!confirmation) {
      setError("Unable to verify. Please restart onboarding.");
      return;
    }


    setLoading(true);
    try {
      // 1) Confirm the Firebase SMS OTP
      await confirmation.confirm(code);


      // 2) Exchange session+code for backend JWT
      const { data } = await api.post<{ access_token: string }>(
        "/auth/confirm-otp",
        {
          session_id:   confirmation.verificationId,
          code,
          first_name:   onboardingData!.firstName,
          last_name:    onboardingData!.lastName,
          phone:        onboardingData!.phone,
          email:        onboardingData!.email,
          tenant_id:    "default", // <-- Add this line
        }
      );
      const token = data.access_token;


      // 3) Configure Axios + AuthContext
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      await loginWithToken(token);


      // 4) Create your application user
      await api.post("/users", {
        uid:        auth.currentUser!.uid,
        first_name: onboardingData!.firstName,
        last_name:  onboardingData!.lastName,
        phone:      onboardingData!.phone,
        subscribe:  onboardingData!.subscribe,
      });


      // 5) Register in loyalty subsystem
      await api.post("/loyalty/register", {
        first_name: onboardingData!.firstName,
        last_name:  onboardingData!.lastName,
        phone:      onboardingData!.phone,
        email:      onboardingData!.email,
      });


      // 6) Done! Set justOnboarded flag and redirect home
      localStorage.setItem("justOnboarded", "true");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("OTP confirm failed", err);
      if (!err.response) {
        toast.error("Network error. Please check your connection and try again.");
        setError("Network error. Please check your connection and try again.");
        return;
      }
      const msg =
        err.response?.data?.detail ??
        err.message ??
        "Invalid OTP or network error.";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  // Restart signup on resend
  const resend = async () => {
    if (timer > 0) return;
    try {
      // Use the phone number from onboardingData or state
      const confirmation = await signInWithPhoneNumber(auth, onboardingData!.phone, window.recaptchaVerifier);
      confirmationRef.current = confirmation; // update your confirmation object
      toast.success("OTP resent!");
    } catch (err) {
      toast.error("Failed to resend OTP.");
    }
  };


  return (
    <PageLayout loading={loading} error={error || undefined}>
      <Container>
        <div className="max-w-sm mx-auto p-6">
          <h1 className="text-xl font-semibold mb-4">Enter Verification Code</h1>
          {/* Error message shown via layout */}


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
            <Button
              variant="secondary"
              onClick={resend}
              disabled={timer > 0 || loading}
              className="underline"
            >
              {timer > 0 ? `Resend in 0:${timer.toString().padStart(2, "0")}` : "Resend Code"}
            </Button>
            <Button
              variant="primary"
              onClick={submitOTP}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </div>
      </Container>
    </PageLayout>
  );
};


// This file has been moved to src/features/auth/pages/OTPVerify.tsx
export default OTPVerify;