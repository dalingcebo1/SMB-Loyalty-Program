// src/components/form/TextFieldControlled.tsx
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import TextField from '../ui/TextField';

export interface TextFieldControlledProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  helperText?: string;
}

export const TextFieldControlled: React.FC<TextFieldControlledProps> = ({ name, label, helperText, ...props }) => {
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          {...field}
          {...props}
          label={label}
          error={error}
          helperText={helperText}
        />
      )}
    />
  );
};
