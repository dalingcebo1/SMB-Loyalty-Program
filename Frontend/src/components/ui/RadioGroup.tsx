// src/components/ui/RadioGroup.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface Option {
  label: string;
  value: string;
}

interface RadioGroupProps {
  name: string;
  options: Option[];
  selectedValue?: string;
  onChange: (value: string) => void;
  direction?: 'row' | 'column';
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  selectedValue,
  onChange,
  direction = 'column',
}) => {
  const containerClass = direction === 'row' ? 'flex space-x-md' : 'flex flex-col space-y-sm';

  return (
    <div className={containerClass} role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const checked = opt.value === selectedValue;
        return (
          <label
            key={opt.value}
            className={twMerge(
              'inline-flex items-center cursor-pointer',
              checked ? 'text-primary' : 'text-gray700'
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className={twMerge(
                'h-4 w-4 border-gray300 text-primary focus:ring-primary',
                checked && 'checked:bg-primary'
              )}
            />
            <span className="ml-sm">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
};

export default RadioGroup;
