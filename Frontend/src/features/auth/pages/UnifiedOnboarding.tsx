import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  signInWithPhoneNumber,
  ConfirmationResult,
  RecaptchaVerifier,
} from "firebase/auth";
import { auth, getGlobalRecaptcha } from "../../../firebase";
import Loading from "../../../components/Loading";
import api from "../../../api/api";
import { confirmationRef } from "../../../utils/confirmationRef";
import "./UnifiedOnboarding.css";

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
    let baseVerifier: RecaptchaVerifier;
    try {
      // Grab the verifier from the helper so we avoid relying on async state updates
      baseVerifier = await ensureRecaptchaReady();
    } catch {
      setError('Could not prepare reCAPTCHA. Please reload the page.');
      return;
    }

    setSending(true);
    try {
      // Always sign in with phone (no account linking path for simplicity)
      let activeVerifier = baseVerifier;
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
    <div className="onboarding-container">
      {(sending || loading) && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      <div className="onboarding-card">
        <div className="onboarding-header">
          <h1 className="onboarding-title">
            {currentStep === 'profile' ? 'Complete Your Profile' : 'Verify Your Phone'}
          </h1>
          <p className="onboarding-subtitle">
            {currentStep === 'profile' 
              ? 'Help us personalize your experience' 
              : 'We\'ll send you a verification code'
            }
          </p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          <div className={`step-dot ${currentStep === 'profile' ? 'active' : 'completed'}`}></div>
          <div className={`step-dot ${currentStep === 'phone' ? 'active' : ''}`}></div>
        </div>
        
        {error && <div className="error-message">{error}</div>}

        {currentStep === 'profile' ? (
          // Profile completion form
          <div className="progress-section">
            <h2 className="progress-title">Tell us about yourself</h2>
            <p className="progress-description">
              This information helps us provide you with a personalized experience.
            </p>
          </div>
        ) : (
          // Phone verification intro
          <div className="progress-section">
            <h2 className="progress-title">Phone verification</h2>
            <p className="progress-description">
              We'll send a verification code to your phone number to complete setup.
            </p>
            
            <div className="info-card">
              <div className="info-card-title">Why do we need your phone?</div>
              <div className="info-card-text">
                Your phone number helps us send important updates about your orders and loyalty rewards. 
                It also adds an extra layer of security to your account.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={currentStep === 'profile' ? handleProfileSubmit : handlePhoneSubmit} className="onboarding-form">
          {currentStep === 'profile' ? (
            // Profile completion form
            <>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="form-input"
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="form-input"
                  placeholder="Enter your last name"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="onboarding-button"
              >
                {loading ? "Updating…" : "Continue to Phone Verification"}
              </button>
            </>
          ) : (
            // Phone verification form
            <>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  value={`${firstName} ${lastName}`}
                  disabled
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <div className="phone-input-group">
                  <span className="phone-flag">🇿🇦</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+27821234567"
                    className="form-input phone-input"
                    required
                  />
                </div>
                <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  Include country code (e.g., +27 for South Africa)
                </small>
              </div>

              <div className="checkbox-group">
                <input
                  id="subscribe"
                  type="checkbox"
                  checked={subscribe}
                  onChange={e => setSubscribe(e.target.checked)}
                  className="checkbox-input"
                />
                <label htmlFor="subscribe" className="checkbox-label">
                  Subscribe to newsletter and promotional updates
                </label>
              </div>

              {/* Global reCAPTCHA used; container mounted outside React */}

              <button
                type="submit"
                disabled={sending || !recaptchaReady}
                className="onboarding-button"
              >
                {sending ? "Sending…" : !recaptchaReady ? 'Preparing Security Check…' : "Send Verification Code"}
              </button>
              
              {!recaptchaReady && currentStep === 'phone' && (
                <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                  Loading security verification...
                </p>
              )}
            </>
          )}
        </form>
      </div>
      
      {import.meta.env.DEV && (
        <div className="debug-panel">
          <div className="debug-title">[Development Debug Info]</div>
          <div className="debug-item">recaptchaReady: {String(recaptchaReady)}</div>
          <div className="debug-item">hasVerifier: {String(!!verifier)}</div>
          <div className="debug-item">currentUser: {auth.currentUser ? auth.currentUser.uid : 'none'}</div>
          <div className="debug-item">currentUserProviders: {auth.currentUser?.providerData.map(p=>p.providerId).join(',') || 'n/a'}</div>
          <div className="debug-item">phoneLinked: {auth.currentUser?.phoneNumber || 'no'}</div>
          <div className="debug-item">lastPhoneError: {lastPhoneError || 'none'}</div>
        </div>
      )}
    </div>
  );
};

export default UnifiedOnboarding;
