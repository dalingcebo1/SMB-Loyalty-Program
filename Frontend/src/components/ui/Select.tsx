// src/components/ui/Select.tsx
import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  helperText?: string;
  error?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  options,
  helperText,
  error,
  className,
  id,
  ...props
}) => {
  const generatedId = id || React.useId();
  const helperId = helperText ? `${generatedId}-helper` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={generatedId} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={generatedId}
        aria-invalid={!!error}
        aria-describedby={helperId}
        className={`w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-600 focus:border-red-600' : 'border-gray-300'} ${className || ''}`}        
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p id={helperId} className="text-gray-500 text-sm">
          {helperText}
        </p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
};

export default Select;
