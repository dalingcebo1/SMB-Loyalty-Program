import React, { useState } from 'react';
import StarRating from './StarRating';
import { Button } from '../ui';

export interface ReviewFormValues {
  overall_rating: number;
  service_quality_rating: number;
  stylist_rating: number;
  cleanliness_rating: number;
  value_rating: number;
  review_title: string;
  review_text: string;
}

export interface ReviewFormProps {
  /** Called when the form is submitted with valid data. */
  onSubmit: (values: ReviewFormValues) => void | Promise<void>;
  /** Whether submission is in progress. */
  submitting?: boolean;
  /** Additional CSS class. */
  className?: string;
}

const ratingFields: { key: keyof Pick<ReviewFormValues,
  'overall_rating' | 'service_quality_rating' | 'stylist_rating' | 'cleanliness_rating' | 'value_rating'
>; label: string }[] = [
  { key: 'overall_rating', label: 'Overall' },
  { key: 'service_quality_rating', label: 'Service quality' },
  { key: 'stylist_rating', label: 'Stylist' },
  { key: 'cleanliness_rating', label: 'Cleanliness' },
  { key: 'value_rating', label: 'Value for money' },
];

/**
 * A form that lets customers submit a review with:
 * - Five 1-5 star rating categories
 * - Optional title and free-text comment
 */
const ReviewForm: React.FC<ReviewFormProps> = ({
  onSubmit,
  submitting = false,
  className = '',
}) => {
  const [ratings, setRatings] = useState<Record<string, number>>({
    overall_rating: 0,
    service_quality_rating: 0,
    stylist_rating: 0,
    cleanliness_rating: 0,
    value_rating: 0,
  });
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const allRated = Object.values(ratings).every((v) => v >= 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRated) {
      setError('Please provide a rating for every category.');
      return;
    }
    setError(null);
    onSubmit({
      overall_rating: ratings.overall_rating,
      service_quality_rating: ratings.service_quality_rating,
      stylist_rating: ratings.stylist_rating,
      cleanliness_rating: ratings.cleanliness_rating,
      value_rating: ratings.value_rating,
      review_title: title,
      review_text: text,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`review-form ${className}`}
      data-testid="review-form"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {ratingFields.map(({ key, label }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ minWidth: 130, fontSize: 14, fontWeight: 500 }}>{label}</span>
          <StarRating
            value={ratings[key]}
            onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))}
          />
        </div>
      ))}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Title (optional)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Summarise your experience"
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
          }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Comment (optional)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Tell others about your experience…"
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            resize: 'vertical',
          }}
        />
      </label>

      {error && (
        <p role="alert" style={{ color: '#ef4444', fontSize: 14, margin: 0 }}>
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} isLoading={submitting}>
        Submit Review
      </Button>
    </form>
  );
};

export default ReviewForm;
