// src/pages/Onboarding.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signInWithPhoneNumber, ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { auth, makeRecaptcha } from "../firebase";

export const confirmationRef = React.createRef<ConfirmationResult>();

interface LocationState {
  email: string;
  password: string;
}

// Validate E.164 phone format: +{countrycode}{number} (10-15 digits)
const validateE164 = (num: string) => /^\+\d{10,15}$/.test(num);

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: LocationState };
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [subscribe, setSubscribe] = useState(false);
  const [error,     setError]     = useState("");
  const [verifier,  setVerifier]  = useState<RecaptchaVerifier | null>(null);

  // 1) Redirect back if email/password missing
  useEffect(() => {
    if (!state?.email || !state?.password) {
      navigate("/signup", { replace: true });
    }
  }, [state, navigate]);

  // 2) Initialize the invisible reCAPTCHA only once
  useEffect(() => {
    if (verifier || !recaptchaRef.current) return;

    makeRecaptcha("recaptcha-container")
      .then((v) => setVerifier(v))
      .catch((e) => {
        console.error("reCAPTCHA init failed", e);
        setError(
          "Could not initialize reCAPTCHA. Check your network or disable blockers."
        );
      });
  }, [verifier]);

  // 3) Handle form submission and send OTP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Basic field validation
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError("All fields are required.");
      return;
    }

    // E.164 phone format validation
    if (!validateE164(phone.trim())) {
      setError("Phone number must be in E.164 format, e.g. +27821234567.");
      return;
    }

    // Ensure reCAPTCHA is ready
    if (!verifier) {
      setError("reCAPTCHA not ready. Please wait a moment and try again.");
      return;
    }

    try {
      // Send OTP
      const confirmation: ConfirmationResult = await signInWithPhoneNumber(
        auth,
        phone.trim(),
        verifier
      );
      confirmationRef.current = confirmation;

      // Pass data to OTP verification page
      navigate("/onboarding/verify", {
        state: {
          email:    state!.email,
          password: state!.password,
          firstName,
          lastName,
          phone,
          subscribe,
        },
      });
    } catch (err: any) {
      console.error("Send OTP failed", err);
      switch (err.code) {
        case "auth/invalid-phone-number":
          setError("The phone number you entered is invalid.");
          break;
        case "auth/quota-exceeded":
          setError("SMS quota exceeded; please try again later.");
          break;
        default:
          setError("Could not send OTP. Please check your network and try again.");
      }
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Complete Your Onboarding</h2>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First Name */}
        <div>
          <label className="block text-sm font-medium">First Name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            required
          />
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-medium">Last Name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            required
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+27821234567"
            className="mt-1 block w-full border rounded p-2"
            required
          />
        </div>

        {/* Subscribe to Newsletter */}
        <div className="flex items-center">
          <input
            id="subscribe"
            type="checkbox"
            checked={subscribe}
            onChange={(e) => setSubscribe(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="subscribe" className="ml-2 block text-sm">
            Subscribe to newsletter
          </label>
        </div>

        {/* Invisible reCAPTCHA mount point */}
        <div id="recaptcha-container" ref={recaptchaRef} />

        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Send OTP
        </button>
      </form>
    </div>
  );
};

export default Onboarding;
