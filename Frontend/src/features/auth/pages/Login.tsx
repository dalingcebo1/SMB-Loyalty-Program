// src/features/auth/pages/Login.tsx

import React, { useEffect, useState } from "react";
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
  const { login } = useAuth();
  const navigate = useNavigate();

  const [authError, setAuthError] = useState<string | null>(null);
  const [lastCreds, setLastCreds] = useState<FormData | null>(null);

  const methods = useForm<FormData>({ defaultValues: { email: "", password: "" } });
  const { handleSubmit, formState: { isSubmitting } } = methods;

  useEffect(() => {
    setAuthError(null);
  }, []);

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      const currentUser = await login(data.email, data.password);
      if (currentUser.role === "staff" || currentUser.role === "admin") {
        navigate("/staff", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      setLastCreds(data);

      if (err.response?.status === 404) {
        setAuthError("Email is not registered. Please sign up first.");
      } else if (err.response?.status === 401) {
        setAuthError("Incorrect email or password.");
      } else if (err.response?.status === 403) {
        setAuthError("Please complete onboarding before logging in.");
      } else {
        setAuthError("Unable to log in right now. Please try again later.");
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
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </Button>
          </form>
        </FormProvider>

        {authError && (
          <div className="text-center space-y-2">
            <p className="text-red-500 text-sm">{authError}</p>
            {authError.includes("onboarding") && lastCreds && (
              <button
                onClick={() =>
                  navigate("/onboarding", {
                    state: {
                      email: lastCreds.email,
                      password: lastCreds.password,
                    },
                  })
                }
                className="text-blue-600 underline text-sm"
              >
                Complete onboarding →
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
      </div>
    </PageLayout>
  );
};

export default Login;
