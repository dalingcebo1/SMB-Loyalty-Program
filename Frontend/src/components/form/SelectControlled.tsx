// src/components/form/SelectControlled.tsx
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import Select from '../ui/Select';

export interface Option {
  value: string;
  label: string;
}

export interface SelectControlledProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  label: string;
  options: Option[];
  helperText?: string;
}

export const SelectControlled: React.FC<SelectControlledProps> = ({ name, label, options, helperText, ...props }) => {
  const { control, formState: { errors } } = useFormContext();
  const error = errors[name]?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          {...field}
          {...props}
          label={label}
          options={options}
          helperText={helperText}
          error={error}
        />
      )}
    />
  );
};
