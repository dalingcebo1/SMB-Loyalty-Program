import React from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Switch } from "@headlessui/react"; // or your own toggle
import api from "../api/api";

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  subscribe: boolean;
}

const Onboarding: React.FC = () => {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { subscribe: false }
  });
  const navigate = useNavigate();

  const onSubmit = async (data: FormData) => {
    try {
      // send OTP to phone
      await api.post("/auth/send-otp", { phone: data.phone });
      // navigate to OTP screen, passing along the profile info
      navigate("/onboarding/verify", { state: data });
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to send OTP");
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 space-y-6">
      <h1 className="text-2xl font-semibold text-center">Registration Step 2</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input
          type="text"
          placeholder="Name"
          className="w-full border rounded px-3 py-2"
          {...register("firstName", { required: "First name is required" })}
        />
        {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName.message}</p>}

        <input
          type="text"
          placeholder="Surname"
          className="w-full border rounded px-3 py-2"
          {...register("lastName", { required: "Last name is required" })}
        />
        {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName.message}</p>}

        <input
          type="tel"
          placeholder="Phone"
          className="w-full border rounded px-3 py-2"
          {...register("phone", {
            required: "Phone number is required",
            pattern: {
              value: /^[0-9]{10,15}$/,
              message: "Enter a valid phone number"
            }
          })}
        />
        {errors.phone && <p className="text-red-500 text-sm">{errors.phone.message}</p>}

        <div className="flex items-center space-x-2">
          <Controller
            name="subscribe"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
                className={`${field.value ? 'bg-blue-600' : 'bg-gray-300'} relative inline-flex h-6 w-11 items-center rounded-full`}
              >
                <span
                  className={`${field.value ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform bg-white rounded-full transition-transform`}
                />
              </Switch>
            )}
          />
          <span>Subscribe to newsletter</span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full border rounded px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
        >
          {isSubmitting ? "Sending OTP…" : "Send OTP"}
        </button>
      </form>

      <div className="flex justify-between text-sm text-gray-600">
        <button onClick={() => navigate("/")} className="underline">Skip</button>
        <button onClick={() => handleSubmit(onSubmit)()} className="underline">Next</button>
      </div>
    </div>
  );
};

export default Onboarding;
