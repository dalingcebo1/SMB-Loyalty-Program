// src/features/auth/pages/Login.tsx

import React, { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { useForm, FormProvider } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { TextFieldControlled } from "../../../components/form/TextFieldControlled";
import Button from "../../../components/ui/Button";
import PageLayout from "../../../components/PageLayout";

interface FormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const { login, socialLogin } = useAuth();
  const navigate = useNavigate();

  const [authError, setAuthError] = useState<string | null>(null);
  const [lastCreds, setLastCreds] = useState<FormData | null>(null);

  const methods = useForm<FormData>({ defaultValues: { email: "", password: "" } });
  const { handleSubmit, formState: { isSubmitting } } = methods;

  useEffect(() => { setAuthError(null); }, []);

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      const currentUser = await login(data.email, data.password);
      if (currentUser.role === "staff" || currentUser.role === "admin") {
        navigate("/staff", { replace: true });
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
    <PageLayout
      loading={isSubmitting}
      error={authError}
      onRetry={() => window.location.reload()}
      loadingText="Logging in…"
    >
      <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
        <h1 className="text-2xl font-semibold text-center">Log In</h1>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextFieldControlled name="email" label="Email" />
            <TextFieldControlled name="password" label="Password" type="password" />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </FormProvider>

        {authError && (
          <div className="text-center space-y-2">
            <p className="text-red-500 text-sm">{authError}</p>
            {authError.includes("profile and phone verification") && lastCreds && (
              <button
                onClick={() => navigate("/onboarding", { state: { email: lastCreds.email, password: lastCreds.password } })}
                className="text-blue-600 underline text-sm"
              >
                Complete profile setup →
              </button>
            )}
          </div>
        )}

        <p className="text-center text-sm">
          Don’t have an account?{' '}
          <Link to="/signup" className="text-blue-600 underline">
            Sign up
          </Link>
        </p>

        <div className="mt-6 text-center">
          <p className="text-gray-500 mb-2">Or continue with</p>
          <Button variant="outline" onClick={handleSocial} className="w-full">
            Continue with Google
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default Login;
