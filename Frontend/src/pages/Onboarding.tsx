// src/pages/Onboarding.tsx
import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
//import api from "../api/api";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  subscribe: boolean;
}

// Will hold Firebase’s ConfirmationResult
export const confirmationRef = React.createRef<import("firebase/auth").ConfirmationResult>();

const Onboarding: React.FC = () => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ defaultValues: { subscribe: false } });
  const navigate = useNavigate();

  // Keep the last submitted data so we can pass it along to OTPVerify
  const formDataRef = React.useRef<FormData | null>(null);

  // local loading state
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const auth = getAuth();
    if (!window.recaptchaVerifier) {
      const verifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
      verifier
        .render()
        .then(() => {
          window.recaptchaVerifier = verifier;
        })
        .catch((err) => {
          console.error("reCAPTCHA render failed:", err);
        });
    }
  }, []);

  const onSubmit = async (data: FormData) => {
    formDataRef.current = data;
    setLoading(true);

    const auth = getAuth();
    // convert leading zero format to E.164 +27...
    const phoneNumber = data.phone.startsWith("+")
      ? data.phone
      : "+27" + data.phone.slice(1);

    try {
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        // @ts-ignore recaptchaVerifier injected on window
        window.recaptchaVerifier
      );
      confirmationRef.current = confirmationResult;
      navigate("/onboarding/verify", { state: formDataRef.current });
    } catch (err: any) {
      console.error("Failed to send OTP:", err);
      alert(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <div id="recaptcha-container"></div>
      <div className="text-center text-sm text-gray-500">Step 1 of 2</div>
      <h1 className="text-2xl font-semibold text-center">
        Tell us about yourself.
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input
          type="text"
          placeholder="First name"
          className="w-full border rounded px-3 py-2"
          {...register("firstName", { required: true })}
        />
        {errors.firstName && (
          <p className="text-red-500 text-sm">First name is required</p>
        )}

        <input
          type="text"
          placeholder="Last name"
          className="w-full border rounded px-3 py-2"
          {...register("lastName", { required: true })}
        />
        {errors.lastName && (
          <p className="text-red-500 text-sm">Last name is required</p>
        )}

        <input
          type="tel"
          placeholder="Cell number"
          className="w-full border rounded px-3 py-2"
          {...register("phone", {
            required: "Cell number is required",
            pattern: {
              // either 0XXXXXXXXX or +27XXXXXXXXX
              value: /^(\+27|0)\d{9}$/,
              message: "Enter a valid South African phone number",
            },
            onChange: (e) => {
              // strip out spaces as you type
              const cleaned = e.target.value.replace(/\s+/g, "");
              setValue("phone", cleaned, { shouldValidate: true });
            },
          })}
        />
        {errors.phone && (
          <p className="text-red-500 text-sm">{errors.phone.message}</p>
        )}

        <div className="text-center text-gray-700">
          <p>Would you like to keep in touch with us?</p>
          <p className="mt-1">Subscribe to our newsletter</p>
          <label className="inline-flex items-center mt-2">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600"
              {...register("subscribe")}
            />
            <span className="ml-2">Yes, sign me up</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Next…" : "Next"}
        </button>
      </form>
    </div>
  );
};

export default Onboarding;
