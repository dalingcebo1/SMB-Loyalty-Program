import React from 'react';
import StarRating from './StarRating';

export interface AverageRatingProps {
  /** Average rating value (e.g. 4.3). */
  average: number;
  /** Total number of reviews contributing to the average. */
  count: number;
  /** Star size in pixels. @default 18 */
  size?: number;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Compact aggregate rating display, e.g. "4.3 ★★★★☆ (27 reviews)".
 */
const AverageRating: React.FC<AverageRatingProps> = ({
  average,
  count,
  size = 18,
  className = '',
}) => {
  if (count === 0) {
    return (
      <span className={`average-rating ${className}`} data-testid="average-rating-empty">
        <span style={{ fontSize: 13, color: '#9ca3af' }}>No reviews yet</span>
      </span>
    );
  }

  return (
    <span
      className={`average-rating ${className}`}
      data-testid="average-rating"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span style={{ fontWeight: 600, fontSize: 14 }}>{average.toFixed(1)}</span>
      <StarRating value={Math.round(average)} size={size} />
      <span style={{ fontSize: 13, color: '#6b7280' }}>
        ({count} {count === 1 ? 'review' : 'reviews'})
      </span>
    </span>
  );
};

export default AverageRating;
