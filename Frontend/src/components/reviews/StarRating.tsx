import React, { useState } from 'react';

export interface StarRatingProps {
  /** Current rating value (1–5). */
  value: number;
  /** Called when the user selects a new rating. Omit for read-only display. */
  onChange?: (value: number) => void;
  /** Total number of stars. @default 5 */
  max?: number;
  /** Pixel size of each star. @default 24 */
  size?: number;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Reusable star rating component.
 *
 * - Interactive mode (onChange provided): stars are clickable buttons.
 * - Read-only mode: renders as a static display.
 */
const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  max = 5,
  size = 24,
  className = '',
}) => {
  const [hovered, setHovered] = useState<number>(0);
  const interactive = typeof onChange === 'function';

  const stars = Array.from({ length: max }, (_, i) => i + 1);

  const displayValue = interactive && hovered > 0 ? hovered : value;

  return (
    <span
      className={`star-rating ${className}`}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? 'Star rating' : `${value} out of ${max} stars`}
      onMouseLeave={() => interactive && setHovered(0)}
      style={{ display: 'inline-flex', gap: 2 }}
    >
      {stars.map((star) => {
        const filled = star <= displayValue;
        if (interactive) {
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === value}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHovered(star)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                fontSize: size,
                color: filled ? '#f59e0b' : '#d1d5db',
              }}
            >
              ★
            </button>
          );
        }
        return (
          <span
            key={star}
            aria-hidden="true"
            style={{
              fontSize: size,
              color: filled ? '#f59e0b' : '#d1d5db',
              lineHeight: 1,
            }}
          >
            ★
          </span>
        );
      })}
    </span>
  );
};

export default StarRating;
