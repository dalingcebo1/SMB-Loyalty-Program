import React from 'react';
import StarRating from './StarRating';
import { formatDate } from '../../utils/format';
import type { ReviewResponse } from '../../types/review';

export interface ReviewCardProps {
  review: ReviewResponse;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Displays a single customer review: stars, title, text, date and author.
 */
const ReviewCard: React.FC<ReviewCardProps> = ({ review, className = '' }) => {
  return (
    <div
      className={`review-card ${className}`}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
      data-testid="review-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <StarRating value={review.overall_rating} size={18} />
        <time
          dateTime={review.created_at}
          style={{ fontSize: 13, color: '#6b7280' }}
        >
          {formatDate(review.created_at)}
        </time>
      </div>

      {review.review_title && (
        <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          {review.review_title}
        </h4>
      )}

      {review.review_text && (
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#374151' }}>
          {review.review_text}
        </p>
      )}

      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280' }}>
        <span data-testid="review-customer">{review.customer_name}</span>
        <span data-testid="review-service">{review.service_name}</span>
      </div>
    </div>
  );
};

export default ReviewCard;
