// src/components/ui/TextField.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const TextField: React.FC<TextFieldProps> = ({ label, error, helperText, className, id, ...props }) => {
  const generatedId = id || React.useId();
  const helperId = helperText ? `${generatedId}-helper` : undefined;
  return (
    <div className="space-y-xs">
      <label htmlFor={generatedId} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={generatedId}
        aria-invalid={!!error}
        aria-describedby={helperId}
        className={twMerge(
          'w-full border border-gray300 focus:outline-none focus:ring-2 focus:ring-primary',
          'px-md py-sm rounded-md',
          error
            ? 'border-danger focus:ring-danger'
            : '',
          className
        )}
        {...props}
      />
      {helperText && (
        <p id={helperId} className="text-gray300 text-sm">
          {helperText}
        </p>
      )}
      {error && (
        <p className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
};

export default TextField;

