// src/features/auth/pages/Login.tsx

import React, { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { isFirebaseEnabled } from "../../../firebase";
import "../styles/auth-shared.css";
import AuthLayout from "../components/AuthLayout";
import AuthField from "../components/AuthField";

interface FormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const { login, socialLogin } = useAuth();
  const navigate = useNavigate();

  const [authError, setAuthError] = useState<string | null>(null);
  const [lastCreds, setLastCreds] = useState<FormData | null>(null);

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<FormData>({
    defaultValues: { email: "", password: "" }
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { setAuthError(null); }, []);

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      const currentUser = await login(data.email, data.password);
      if (currentUser.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (currentUser.role === "staff") {
        navigate("/staff/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      setLastCreds(data);
      const status = (err as AxiosError).response?.status;
      if (status === 404) setAuthError("Email is not registered. Please sign up first.");
      else if (status === 401) setAuthError("Incorrect email or password.");
      else if (status === 403) setAuthError("Please complete your profile and phone verification to continue.");
      else setAuthError("Unable to log in right now. Please try again later.");
    }
  };

  const handleSocial = async () => {
    setAuthError(null);
    try {
      // Initiate social login via redirect; navigation will occur on return
      await socialLogin();
      // we do not handle navigation here because redirect will reload the app
    } catch (error: unknown) {
      // Handle user cancellation gracefully
      if (error instanceof Error) {
        if (error.message === 'Sign-in was cancelled') {
          // Don't show an error for user cancellation - this is normal behavior
          console.log("User cancelled Google sign-in");
          return;
        }
        
        console.error("Social login error in component:", error);
        // Show the specific error message from AuthProvider
        setAuthError(error.message);
      } else if (error && typeof error === 'object' && 'response' in error) {
        // Handle 403 for onboarding (this is expected)
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 403) {
          // Onboarding redirect will be handled by AuthProvider
          return;
        }
      } else {
        setAuthError("Social login failed. Please try again.");
      }
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to continue"
      subtitle="Access your bookings, loyalty rewards, and personalised offers in one place."
      error={authError}
      errorAction={authError?.includes("profile and phone verification") && lastCreds ? (
        <button
          type="button"
          onClick={() => navigate("/onboarding", { state: { email: lastCreds.email, password: lastCreds.password } })}
          className="auth-link"
        >
          Complete profile setup →
        </button>
      ) : null}
      footer={<>
        <span>Don’t have an account? <Link to="/signup" className="auth-link">Sign up</Link></span>
        <span>Need help? <Link to="/forgot-password" className="auth-link">Reset password</Link></span>
      </>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
        <AuthField
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          inputProps={{
            ...register("email", { required: "Email is required" }),
            autoComplete: 'email',
            // @ts-expect-error custom data attribute allowed
            'data-cy': 'login-email'
          }}
        />
        <AuthField
          id="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter your password"
          helper="Minimum 8 characters recommended."
          error={errors.password?.message}
          inputProps={{
            ...register("password", { required: "Password is required" }),
            autoComplete: 'current-password',
            // @ts-expect-error custom data attribute allowed
            'data-cy': 'login-password'
          }}
          after={(
            <button
              type="button"
              className="auth-toggle-password"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(p => !p)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        />
        <div className="auth-inline-actions">
          <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="auth-button auth-button--primary"
          data-cy="login-submit"
          aria-busy={isSubmitting}
        >
          {isSubmitting && <span className="auth-loading-spinner" aria-hidden="true"></span>}
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className="auth-divider">Or continue with</div>
      <button
        onClick={handleSocial}
        className={"auth-button auth-button--google" + (!isFirebaseEnabled ? ' auth-button--disabled' : '')}
        disabled={!isFirebaseEnabled}
        title={isFirebaseEnabled ? '' : 'Google sign-in disabled: missing Firebase config'}
        type="button"
        aria-disabled={!isFirebaseEnabled}
      >
        {isFirebaseEnabled ? (
          <>
            <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </>
        ) : (
          <>
            <div className="auth-button-skeleton" aria-hidden="true">
              <div className="skeleton skeleton-text skeleton--w-60" />
            </div>
            {/* Provide an accessible name for the disabled button so tests & screen readers can announce purpose */}
            <span
              style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
            >
              Continue with Google
            </span>
          </>
        )}
      </button>
      {!isFirebaseEnabled && (
        <div className="auth-alert auth-alert--info" role="status">
          Google sign-in is disabled in this environment. Set VITE_FIREBASE_* to enable.
        </div>
      )}
    </AuthLayout>
  );
};

export default Login;
