import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../utils/test-utils';
import ReviewCard from '../ReviewCard';
import type { ReviewResponse } from '../../../types/review';

const mockReview: ReviewResponse = {
  id: 1,
  appointment_id: 10,
  customer_id: 5,
  customer_name: 'Jane Doe',
  service_id: 3,
  service_name: 'Deluxe Haircut',
  stylist_id: 7,
  stylist_name: 'Thembi M.',
  overall_rating: 4,
  service_quality_rating: 5,
  stylist_rating: 4,
  cleanliness_rating: 5,
  value_rating: 3,
  average_rating: 4.2,
  review_title: 'Great experience!',
  review_text: 'Really enjoyed the service, would recommend.',
  approved: true,
  featured: false,
  created_at: '2026-03-15T10:00:00Z',
};

describe('ReviewCard', () => {
  it('renders review title and text', () => {
    render(<ReviewCard review={mockReview} />);
    expect(screen.getByText('Great experience!')).toBeInTheDocument();
    expect(screen.getByText('Really enjoyed the service, would recommend.')).toBeInTheDocument();
  });

  it('renders customer name and service name', () => {
    render(<ReviewCard review={mockReview} />);
    expect(screen.getByTestId('review-customer')).toHaveTextContent('Jane Doe');
    expect(screen.getByTestId('review-service')).toHaveTextContent('Deluxe Haircut');
  });

  it('renders star rating matching overall_rating', () => {
    render(<ReviewCard review={mockReview} />);
    const ratingImg = screen.getByRole('img');
    expect(ratingImg).toHaveAttribute('aria-label', '4 out of 5 stars');
  });

  it('renders formatted date', () => {
    render(<ReviewCard review={mockReview} />);
    const time = screen.getByText(/Mar/);
    expect(time).toBeInTheDocument();
  });

  it('handles missing title and text gracefully', () => {
    const review = { ...mockReview, review_title: undefined, review_text: undefined };
    const { container } = render(<ReviewCard review={review} />);
    expect(container.querySelector('h4')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });
});
