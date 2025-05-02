import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";

// Keep the existing styling and structure as in your repo;
// all new error cases are handled below.
export const confirmationRef = React.createRef<ConfirmationResult>();

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const recaptchaContainer = useRef<HTMLDivElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [subscribe, setSubscribe] = useState(false);
  const [error, setError] = useState("");

  // Initialize reCAPTCHA on mount
  useEffect(() => {
    if (recaptchaContainer.current) {
      try {
        // Assuming you have firebase/auth loaded globally
        (window as any).recaptchaVerifier = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          { size: "invisible" }
        );
      } catch (err) {
        console.error("Recaptcha init error", err);
        setError(
          "Failed to initialize reCAPTCHA. Please refresh the page and try again."
        );
      }
    }
  }, [auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Basic form validations
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError("All fields are required.");
      return;
    }

    // Send OTP
    try {
      const appVerifier = (window as any).recaptchaVerifier;
      if (!appVerifier) throw new Error("reCAPTCHA verifier not found");

      const confirmationResult: ConfirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        appVerifier
      );
      confirmationRef.current = confirmationResult;

      // Pass profile data into OTPVerify
      navigate("/onboarding/verify", {
        state: { firstName, lastName, phone, subscribe },
      });
    } catch (err: any) {
      console.error("Error sending OTP:", err);
      // Handle common Firebase Auth errors
      switch (err.code) {
        case "auth/invalid-phone-number":
          setError("That phone number is invalid. Please check and try again.");
          break;
        case "auth/quota-exceeded":
          setError(
            "SMS quota exceeded for today. Please try again later."
          );
          break;
        default:
          setError(
            "Unable to send OTP right now. Please check your network or try again later."
          );
      }
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Complete Your Onboarding</h2>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded p-2"
            required
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded p-2"
            required
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded p-2"
            placeholder="+1 555-0123"
            required
          />
        </div>

        <div className="flex items-center">
          <input
            id="subscribe"
            type="checkbox"
            checked={subscribe}
            onChange={(e) => setSubscribe(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="subscribe" className="ml-2 block text-sm">
            Subscribe to newsletter
          </label>
        </div>

        {/* Invisible reCAPTCHA mount point */}
        <div id="recaptcha-container" ref={recaptchaContainer} />

        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
        >
          Send OTP
        </button>
      </form>
    </div>
  );
};

export default Onboarding;
