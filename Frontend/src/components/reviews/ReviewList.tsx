import React from 'react';
import type { ReviewResponse } from '../../types/review';
import ReviewCard from './ReviewCard';

export interface ReviewListProps {
  /** Reviews to display. */
  reviews: ReviewResponse[];
  /** Whether the list is loading. */
  loading?: boolean;
  /** Message shown when no reviews exist. */
  emptyMessage?: string;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Renders a list of ReviewCards. Shows a loading skeleton or an empty-state
 * message when appropriate.
 */
const ReviewList: React.FC<ReviewListProps> = ({
  reviews,
  loading = false,
  emptyMessage = 'No reviews yet. Be the first to leave one!',
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`review-list ${className}`} aria-busy="true" data-testid="review-list-loading">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 100,
              borderRadius: 12,
              marginBottom: 12,
              background: '#f3f4f6',
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div
        className={`review-list review-list--empty ${className}`}
        data-testid="review-list-empty"
        style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`review-list ${className}`} data-testid="review-list">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
};

export default ReviewList;
