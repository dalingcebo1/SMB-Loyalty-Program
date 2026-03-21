import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../utils/test-utils';
import ReviewList from '../ReviewList';
import type { ReviewResponse } from '../../../types/review';

const makeReview = (id: number): ReviewResponse => ({
  id,
  appointment_id: id + 100,
  customer_id: id,
  customer_name: `Customer ${id}`,
  service_id: 1,
  service_name: 'Basic Wash',
  stylist_id: 1,
  stylist_name: 'Stylist A',
  overall_rating: 4,
  service_quality_rating: 4,
  stylist_rating: 5,
  cleanliness_rating: 4,
  value_rating: 3,
  average_rating: 4.0,
  review_title: `Review ${id}`,
  review_text: `Review text ${id}`,
  approved: true,
  featured: false,
  created_at: '2026-03-10T12:00:00Z',
});

describe('ReviewList', () => {
  it('renders all review cards', () => {
    const reviews = [makeReview(1), makeReview(2), makeReview(3)];
    render(<ReviewList reviews={reviews} />);
    expect(screen.getByTestId('review-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('review-card')).toHaveLength(3);
  });

  it('shows empty message when no reviews', () => {
    render(<ReviewList reviews={[]} />);
    expect(screen.getByTestId('review-list-empty')).toBeInTheDocument();
    expect(screen.getByText(/No reviews yet/)).toBeInTheDocument();
  });

  it('allows custom empty message', () => {
    render(<ReviewList reviews={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    render(<ReviewList reviews={[]} loading />);
    expect(screen.getByTestId('review-list-loading')).toBeInTheDocument();
  });
});
