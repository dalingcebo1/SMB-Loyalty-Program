import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithPhoneNumber,
  ConfirmationResult,
  RecaptchaVerifier,
} from "firebase/auth";
import { auth, makeRecaptcha } from "../firebase";
import PageLayout from "../components/PageLayout";
import { confirmationRef } from "../utils/confirmationRef";

interface LocationState {
  email: string;
  password?: string;          // optional for social users
  firstName?: string;
  lastName?: string;
  fromSocial?: boolean;
  skipProfileStep?: boolean;
  subscribe?: boolean;
  phone?: string;
}

// E.164 format validator
const validateE164 = (num: string) => /^\+\d{10,15}$/.test(num);

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: LocationState };
  const recaptchaDiv = useRef<HTMLDivElement>(null);

  const [firstName, setFirstName] = useState(state?.firstName || "");
  const [lastName,  setLastName]  = useState(state?.lastName || "");
  const [phone,     setPhone]     = useState(state?.phone || "");
  const [subscribe, setSubscribe] = useState(state?.subscribe ?? false);
  const [error,     setError]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [verifier,  setVerifier]  = useState<RecaptchaVerifier | null>(null);

  // Redirect back if email is missing (allow social login without password)
  useEffect(() => {
    if (!state?.email) {
      navigate("/login", { replace: true });
    }
  }, [state, navigate]);

  // Initialize the invisible reCAPTCHA once on mount
  useEffect(() => {
    if (verifier || !recaptchaDiv.current) return;
    makeRecaptcha(recaptchaDiv.current)
      .then(v => setVerifier(v))
      .catch(e => {
        console.error("reCAPTCHA init failed", e);
        setError("Could not initialize reCAPTCHA. Check your network or disable blockers.");
      });
  }, [verifier]); // Include verifier dependency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      return setError("All fields are required.");
    }
    if (!validateE164(phone.trim())) {
      return setError("Phone must be in E.164 format, e.g. +27821234567.");
    }
    if (!verifier) {
      return setError("reCAPTCHA not ready. Please wait a moment.");
    }

    setSending(true);
    try {
      // Trigger the SMS; invisible reCAPTCHA runs automatically
      const confirmation: ConfirmationResult = await signInWithPhoneNumber(
        auth,
        phone.trim(),
        verifier
      );
      confirmationRef.current = confirmation;

      // 3) Move to the OTP entry screen
      navigate("/onboarding/verify", {
        state: {
          email:    state!.email,
          password: state?.password, // may be undefined for social login
          firstName,
          lastName,
          phone:    phone.trim(),
          subscribe,
          fromSocialLogin: state?.fromSocial ?? false,
        },
      });
    } catch (err: unknown) {
      console.error("Send OTP failed", err);
      const error = err as { code?: string };
      switch (error.code) {
        case "auth/invalid-phone-number":
          setError("That phone number is invalid.");
          break;
        case "auth/quota-exceeded":
          setError("SMS quota exceeded; please try again later.");
          break;
        default:
          setError("Could not send OTP. Check your network and try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <PageLayout loading={sending} error={error} onRetry={() => setError("")}>  
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Complete Your Onboarding</h2>
        {error && <p className="text-red-600 mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Read-only Email */}
          <div>
            <label className="block text-sm font-medium">Email Address</label>
            <input
              type="email"
              value={state?.email || ""}
              disabled
              className="mt-1 block w-full border rounded p-2 bg-gray-100"
            />
          </div>

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium">First Name</label>
            <input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
              required
              disabled={state?.fromSocial && !!state?.firstName}
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium">Last Name</label>
            <input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
              required
              disabled={state?.fromSocial && !!state?.lastName}
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+27821234567"
              className="mt-1 block w-full border rounded p-2"
              required
            />
          </div>

          {/* Subscribe */}
          <div className="flex items-center">
            <input
              id="subscribe"
              type="checkbox"
              checked={subscribe}
              onChange={e => setSubscribe(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="subscribe" className="ml-2 block text-sm">
              Subscribe to newsletter
            </label>
          </div>

          {/* Invisible reCAPTCHA container */}
          <div id="recaptcha-container" ref={recaptchaDiv} />

          <button
            type="submit"
            disabled={sending}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send OTP"}
          </button>
        </form>
      </div>
    </PageLayout>
  );
};

// This file has been moved to src/features/auth/pages/Onboarding.tsx
export default Onboarding;
