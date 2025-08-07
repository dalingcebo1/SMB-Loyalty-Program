// src/components/ui/TextField.tsx
import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const TextField: React.FC<TextFieldProps> = ({ label, error, className, ...props }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium">{label}</label>
    <input
      className={`w-full border px-3 py-2 rounded ${error ? 'border-red-600 focus:border-red-600' : ''} ${className || ''}`}
      {...props}
    />
    {error && <p className="text-red-600 text-sm">{error}</p>}
  </div>
);

export default TextField;

