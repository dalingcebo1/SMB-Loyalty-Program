// src/components/form/DatePickerControlled.tsx
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';

export interface DatePickerControlledProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  helperText?: string;
}

export const DatePickerControlled: React.FC<DatePickerControlledProps> = ({ name, label, helperText, ...props }) => {
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-xs">
          <label htmlFor={field.name} className="block text-sm font-medium">
            {label}
          </label>
          <input
            {...field}
            {...props}
            type="date"
            id={field.name}
            className="w-full border border-gray300 px-md py-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {helperText && <p className="text-gray300 text-sm">{helperText}</p>}
          {error && <p className="text-danger text-sm">{error}</p>}
        </div>
      )}
    />
  );
};
