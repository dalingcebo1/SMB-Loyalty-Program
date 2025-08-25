// src/components/ui/Checkbox.tsx
import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({ label, helperText, error, className, id, ...props }) => {
  const generatedId = React.useId();
  const componentId = id || generatedId;
  const helperId = helperText ? `${componentId}-helper` : undefined;

  return (
    <div className="flex items-start space-x-2">
      <input
        type="checkbox"
        id={componentId}
        aria-invalid={!!error}
        aria-describedby={helperId}
        className={`mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${className || ''}`}
        {...props}
      />
      <div className="flex flex-col">
        <label htmlFor={componentId} className="text-sm font-medium">
          {label}
        </label>
        {helperText && (
          <p id={helperId} className="text-gray-500 text-sm">
            {helperText}
          </p>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </div>
  );
};

export default Checkbox;
