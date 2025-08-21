// src/components/ui/TextField.tsx
import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const TextField: React.FC<TextFieldProps> = ({ label, error, helperText, className, id, ...props }) => {
  const generatedId = id || React.useId();
  const helperId = helperText ? `${generatedId}-helper` : undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={generatedId} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={generatedId}
        aria-invalid={!!error}
        aria-describedby={helperId}
        className={`w-full border px-3 py-2 rounded ${error ? 'border-red-600 focus:border-red-600' : ''} ${className || ''}`}
        {...props}
      />
      {helperText && (
        <p id={helperId} className="text-gray-500 text-sm">
          {helperText}
        </p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
};

export default TextField;

