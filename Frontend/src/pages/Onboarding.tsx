// Frontend/src/pages/Onboarding.tsx
import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import api from "../api/api";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

type State =
  | { mode: "google" | "apple" }
  | { mode: "email"; email: string; password: string };

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  subscribe: boolean;
}

export const confirmationRef = React.createRef<any>();

const Onboarding: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    defaultValues: { subscribe: false }
  });
  const navigate = useNavigate();
  const { state } = useLocation();
  const authData = state as State;

  React.useEffect(() => {
    const auth = getAuth();
    if (!window.recaptchaVerifier) {
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      verifier.render().then(() => {
        window.recaptchaVerifier = verifier;
      });
    }
  }, []);

  const onSubmit = async (form: ProfileForm) => {
    const auth = getAuth();
    const raw = form.phone.replace(/\s+/g, "");
    const phoneNumber = raw.startsWith("+") ? raw : "+27" + raw.slice(1);

    try {
      // 1) send OTP
      const confirmation = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        window.recaptchaVerifier
      );
      confirmationRef.current = confirmation;

      // 2) prompt + confirm code
      const code = window.prompt("Enter SMS code") || "";
      await confirmation.confirm(code);

      // 3) link account
      if (authData.mode === "google") {
        await linkWithPopup(auth.currentUser!, new GoogleAuthProvider());
      } else if (authData.mode === "apple") {
        await linkWithPopup(auth.currentUser!, new OAuthProvider("apple.com"));
      } else if (authData.mode === "email") {
        const cred = EmailAuthProvider.credential(
          authData.email,
          authData.password
        );
        await linkWithCredential(auth.currentUser!, cred);
      }

      // 4) onboard in your DB
      await api.post("/auth/onboard", {
        first_name: form.firstName,
        last_name:  form.lastName,
        subscribe:   form.subscribe,
      });

      navigate("/");
    } catch (err: any) {
      console.error("Onboarding failed:", err);
      alert("Onboarding failed. Please try again.");

      // roll back
      const user = getAuth().currentUser;
      if (user) await user.delete().catch(() => {});
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <div id="recaptcha-container"></div>
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
        {errors.firstName && <p className="text-red-500 text-sm">Required</p>}

        <input
          type="text"
          placeholder="Last name"
          className="w-full border rounded px-3 py-2"
          {...register("lastName", { required: true })}
        />
        {errors.lastName && <p className="text-red-500 text-sm">Required</p>}

        <input
          type="tel"
          placeholder="Cell number"
          className="w-full border rounded px-3 py-2"
          {...register("phone", {
            required: "Cell number is required",
            pattern: {
              value: /^(\+27|0)\d{9}$/,
              message: "Valid SA phone: +27XXXXXXXXX or 0XXXXXXXXX",
            },
          })}
        />
        {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}

        <label className="inline-flex items-center">
          <input
            type="checkbox"
            className="form-checkbox h-5 w-5 text-blue-600"
            {...register("subscribe")}
          />
          <span className="ml-2">Subscribe to newsletter</span>
        </label>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700"
        >
          Finish Signup
        </button>
      </form>
    </div>
  );
};

export default Onboarding;
