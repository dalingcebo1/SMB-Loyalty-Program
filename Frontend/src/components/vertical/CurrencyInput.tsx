import React, { useState, useCallback } from 'react';
import { formatCents } from '../../utils/format';

export interface CurrencyInputProps {
  /** Current value in **cents** (integer). */
  value: number;
  /** Called with the new value in **cents**. */
  onChange: (cents: number) => void;
  label?: string;
  name?: string;
  required?: boolean;
  min?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Input that displays formatted rands but stores integer cents.
 *
 * - User types "12.34" → onChange receives 1234 (cents).
 * - Displays the formatted value when blurred.
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  label,
  name,
  required,
  min = 0,
  disabled,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<string>((value / 100).toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setDisplayValue((value / 100).toFixed(2));
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = parseFloat(displayValue);
    if (!isNaN(parsed)) {
      const cents = Math.round(parsed * 100);
      onChange(cents);
      setDisplayValue((cents / 100).toFixed(2));
    } else {
      setDisplayValue((value / 100).toFixed(2));
    }
  }, [displayValue, onChange, value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDisplayValue(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(Math.round(parsed * 100));
      }
    },
    [onChange],
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && '*'}
        </label>
      )}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm">R</span>
        <input
          type="number"
          name={name}
          step="0.01"
          min={min / 100}
          required={required}
          disabled={disabled}
          value={isFocused ? displayValue : (value / 100).toFixed(2)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          className={`w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
          aria-label={label ?? 'Currency amount'}
        />
      </div>
      {!isFocused && value > 0 && (
        <p className="text-xs text-gray-400 mt-0.5">{formatCents(value)}</p>
      )}
    </div>
  );
};

export default CurrencyInput;
