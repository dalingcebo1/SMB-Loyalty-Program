import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/api";
import { TextFieldControlled } from "../components/form/TextFieldControlled";
import Button from "../components/ui/Button";
import PageLayout from "../components/PageLayout";

type FormData = {
  email: string;
  password: string;
};

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [signUpError, setSignUpError] = useState<string>("");

  const methods = useForm<FormData>({ defaultValues: { email: '', password: '' } });
  const { handleSubmit, formState: { isSubmitting } } = methods;

  const onSubmit = async (data: FormData) => {
    setSignUpError("");
    try {
      await api.post("/auth/signup", { email: data.email, password: data.password });
      navigate("/onboarding", { state: { email: data.email, password: data.password } });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string };
      setSignUpError(error.response?.data?.detail || error.message || "Failed to sign up. Please try again.");
    }
  };

  return (
    <PageLayout
      loading={isSubmitting}
      error={signUpError || null}
      onRetry={() => window.location.reload()}
      loadingText="Signing up…"
    >
      <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
        <h1 className="text-2xl font-semibold text-center">Sign Up</h1>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <TextFieldControlled
              name="email"
              label="Email"
              type="email"
              helperText="We'll never share your email."
            />
            <TextFieldControlled
              name="password"
              label="Password"
              type="password"
              helperText="At least 8 characters."
            />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing up…" : "Sign Up"}
            </Button>
          </form>
        </FormProvider>

        <p className="text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 underline">
            Log in
          </Link>
        </p>
      </div>
    </PageLayout>
  );
};

// This file has been moved to src/features/auth/pages/Signup.tsx
export default Signup;
