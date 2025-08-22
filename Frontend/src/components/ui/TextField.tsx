// src/components/ui/TextField.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    // Generate unique id for accessibility
    const hookId = React.useId();
    const generatedId = id || hookId;
    const helperId = helperText ? `${generatedId}-helper` : undefined;
    return (
      <div className="space-y-xs">
        <label htmlFor={generatedId} className="block text-sm font-medium">
          {label}
        </label>
        <input
          ref={ref}
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
          <p role="alert" className="sr-only text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    );
  }
);

TextField.displayName = 'TextField';

export default TextField;

