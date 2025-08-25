import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithPhoneNumber,
  ConfirmationResult,
  RecaptchaVerifier,
} from "firebase/auth";
import { auth, getGlobalRecaptcha } from "../../../firebase";
import PageLayout from "../../../components/PageLayout";
import Loading from "../../../components/Loading";
import api from "../../../api/api";
import { confirmationRef } from "../../../utils/confirmationRef";

interface OnboardingLocationState {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  fromSocialLogin?: boolean;
  skipProfileStep?: boolean;
  subscribe?: boolean;
  phone?: string;
}

// E.164 format validator
const validateE164 = (num: string) => /^\+\d{10,15}$/.test(num);

const UnifiedOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(() => (location.state as OnboardingLocationState) || {}, [location.state]);
  // No in-component container; we use a global body-mounted container

  // Form state
  const [email, setEmail] = useState(state?.email || "");
  const [firstName, setFirstName] = useState(state?.firstName || "");
  const [lastName, setLastName] = useState(state?.lastName || "");
  const [phone, setPhone] = useState(state?.phone || "");
  const [subscribe, setSubscribe] = useState(state?.subscribe ?? false);
  
  // UI state
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifier, setVerifier] = useState<RecaptchaVerifier | null>(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [lastPhoneError, setLastPhoneError] = useState<string | null>(null);
  
  // Step management - determine if user needs profile completion
  const needsProfile = !firstName.trim() || !lastName.trim();
  const [currentStep, setCurrentStep] = useState<'profile' | 'phone'>(needsProfile ? 'profile' : 'phone');

  // Update step when profile data changes
  useEffect(() => {
    const updatedNeedsProfile = !firstName.trim() || !lastName.trim();
    const newStep = updatedNeedsProfile ? 'profile' : 'phone';
    if (newStep !== currentStep) {
      setCurrentStep(newStep);
    }
  }, [firstName, lastName, currentStep]);

  // Derive email if missing: try JWT in localStorage, then Firebase currentUser
  useEffect(() => {
    if (!email) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1] || '')) as { sub?: string };
          if (payload.sub) setEmail(payload.sub);
        } catch { /* ignore */ }
      }
    }
    if (!email && auth.currentUser?.email) {
      setEmail(auth.currentUser.email);
    }
  }, [email]);

  // If this is a social login user who already has complete profile, skip to phone verification
  useEffect(() => {
    if (state?.skipProfileStep && state?.email && state?.firstName && state?.lastName) {
      console.log("🚀 Social login user detected, proceeding to phone verification");
      // Update component state with social login data
      setFirstName(state.firstName);
      setLastName(state.lastName);
    }
  }, [state]);

  // Initialize (or reuse) global reCAPTCHA when entering phone step
  useEffect(() => {
    if (currentStep === 'phone' && !verifier) {
      getGlobalRecaptcha()
        .then(v => { setVerifier(v); setRecaptchaReady(true); })
        .catch(e => {
          console.error('Global reCAPTCHA init failed', e);
          setError('Could not initialize reCAPTCHA. Check blockers or network.');
        });
    }
  }, [currentStep, verifier]);

  // Helper: ensure verifier exists & DOM element still present (re-create if HMR / refresh removed it)
  const ensureRecaptchaReady = async (): Promise<RecaptchaVerifier> => {
  if (verifier) return verifier;
  if (window.recaptchaVerifier) return window.recaptchaVerifier as RecaptchaVerifier;
  const v = await getGlobalRecaptcha();
  setVerifier(v); setRecaptchaReady(true); return v;
  };

  // Persist form state locally in case of refresh/navigation
  useEffect(() => {
    if (email) {
      const snapshot = { firstName, lastName, phone, subscribe };
      localStorage.setItem('onboardingFormDraft', JSON.stringify(snapshot));
    }
  }, [firstName, lastName, phone, subscribe, email]);

  // Hydrate from draft if coming back without location.state (e.g., refresh) but still have token
  useEffect(() => {
    if (!state?.email) {
      try {
        const draftRaw = localStorage.getItem('onboardingFormDraft');
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          if (draft.firstName && !firstName) setFirstName(draft.firstName);
          if (draft.lastName && !lastName) setLastName(draft.lastName);
          if (draft.phone && !phone) setPhone(draft.phone);
          if (typeof draft.subscribe === 'boolean') setSubscribe(draft.subscribe);
        }
      } catch {/* ignore */}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle profile completion step
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    setLoading(true);
    try {
      // For social login users, update profile info in backend before proceeding
      if (state?.fromSocialLogin) {
        await api.put('/auth/me', { first_name: firstName, last_name: lastName });
      }
      
      // Clear error and proceed to phone verification step
      setError("");
      setCurrentStep('phone');
    } catch (err) {
      console.error('Profile update failed', err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle phone verification step
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone.trim()) {
      return setError("Phone number is required.");
    }
    if (!validateE164(phone.trim())) {
      return setError("Phone must be in E.164 format, e.g. +27821234567.");
    }
    // Ensure verifier present (handles HMR or unmounted container)
    try {
      await ensureRecaptchaReady();
  } catch {
      setError('Could not prepare reCAPTCHA. Please reload the page.');
      return;
    }

    setSending(true);
    try {
      // Always sign in with phone (no account linking path for simplicity)
    let activeVerifier = verifier!;
      let triedRebuild = false;
      async function attemptSend(): Promise<ConfirmationResult> {
        try {
      return await signInWithPhoneNumber(auth, phone.trim(), activeVerifier);
        } catch (e: unknown) {
          // If element removed, rebuild once then retry
            const msg = (e as { message?: string })?.message || '';
            if (!triedRebuild && (msg.includes('has been removed') || msg.includes('element has been removed'))) {
              triedRebuild = true;
              console.warn('Rebuilding reCAPTCHA after removal');
              activeVerifier = await ensureRecaptchaReady();
              return attemptSend();
            }
            throw e;
        }
      }
      const confirmation: ConfirmationResult = await attemptSend();
      confirmationRef.current = confirmation;

      // Navigate to OTP verification
    navigate("/onboarding/verify", {
        state: {
      email: email,
          password: state?.password,
          firstName,
          lastName,
          phone: phone.trim(),
          subscribe,
          fromSocialLogin: state?.fromSocialLogin ?? false,
        },
      });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error("Send OTP failed", error.code, error.message, err);
      setLastPhoneError(`${error.code || 'unknown'}: ${error.message || ''}`.trim());
      switch (error.code) {
        case "auth/invalid-phone-number":
          setError("That phone number is invalid.");
          break;
        case "auth/quota-exceeded":
          setError("SMS quota exceeded; please try again later.");
          break;
        case "auth/too-many-requests":
          setError("Too many attempts. Please wait and try again.");
          break;
        case "auth/unauthorized-domain":
          setError("Domain not authorized for Phone Auth. Add this domain in Firebase console.");
          break;
        case "auth/missing-phone-number":
          setError("Phone number missing. Please re-enter and try again.");
          break;
        default: {
          const generic = "Could not send OTP. Check your network and try again.";
          // Surface code in dev to speed debugging
          setError(import.meta.env.DEV && error.code ? `${generic} (${error.code})` : generic);
        }
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading text="Processing…" />;

  return (
    <PageLayout loading={sending} error={error} onRetry={() => setError("")}>  
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">
          {currentStep === 'profile' ? 'Complete Your Profile' : 'Verify Your Phone'}
        </h2>
        
        {error && <p className="text-red-600 mb-4">{error}</p>}

        {currentStep === 'profile' ? (
          // Profile completion form
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="mt-1 block w-full border rounded p-2 bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="mt-1 block w-full border rounded p-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="mt-1 block w-full border rounded p-2"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Updating…" : "Continue to Phone Verification"}
            </button>
          </form>
        ) : (
          // Phone verification form
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                disabled
                className="mt-1 block w-full border rounded p-2 bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">First Name</label>
              <input
                type="text"
                value={firstName}
                disabled
                className="mt-1 block w-full border rounded p-2 bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Last Name</label>
              <input
                type="text"
                value={lastName}
                disabled
                className="mt-1 block w-full border rounded p-2 bg-gray-100"
              />
            </div>

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

            {/* Global reCAPTCHA used; container mounted outside React */}

            <div className="flex flex-col space-y-2">
              <button
                type="submit"
                disabled={sending || !recaptchaReady}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? "Sending…" : !recaptchaReady ? 'Preparing reCAPTCHA…' : "Send OTP"}
              </button>
              {!recaptchaReady && currentStep === 'phone' && (
                <p className="text-xs text-gray-500 text-center">Loading security checks…</p>
              )}
            </div>
          </form>
        )}
      </div>
      {import.meta.env.DEV && (
        <div className="max-w-md mx-auto mt-4 p-3 text-xs bg-gray-100 rounded border border-gray-300 font-mono space-y-1">
          <div className="font-semibold">[OTP Debug]</div>
          <div>recaptchaReady: {String(recaptchaReady)}</div>
          <div>hasVerifier: {String(!!verifier)}</div>
          <div>currentUser: {auth.currentUser ? auth.currentUser.uid : 'none'}</div>
          <div>currentUserProviders: {auth.currentUser?.providerData.map(p=>p.providerId).join(',') || 'n/a'}</div>
          <div>phoneLinked: {auth.currentUser?.phoneNumber || 'no'}</div>
          <div>lastPhoneError: {lastPhoneError || 'none'}</div>
          {/* widgetId removed (unused) */}
        </div>
      )}
    </PageLayout>
  );
};

export default UnifiedOnboarding;
