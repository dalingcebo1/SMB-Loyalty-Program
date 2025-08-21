// src/components/form/CheckboxControlled.tsx
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import Checkbox from '../ui/Checkbox';

export interface CheckboxControlledProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  helperText?: string;
}

export const CheckboxControlled: React.FC<CheckboxControlledProps> = ({ name, label, helperText, ...props }) => {
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Checkbox
          {...field}
          {...props}
          label={label}
          helperText={helperText}
          error={error}
        />
      )}
    />
  );
};
