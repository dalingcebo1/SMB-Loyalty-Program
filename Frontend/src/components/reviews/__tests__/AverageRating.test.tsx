import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../utils/test-utils';
import AverageRating from '../AverageRating';

describe('AverageRating', () => {
  it('displays average and review count', () => {
    render(<AverageRating average={4.3} count={27} />);
    expect(screen.getByTestId('average-rating')).toBeInTheDocument();
    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('(27 reviews)')).toBeInTheDocument();
  });

  it('uses singular "review" for count of 1', () => {
    render(<AverageRating average={5} count={1} />);
    expect(screen.getByText('(1 review)')).toBeInTheDocument();
  });

  it('shows "No reviews yet" when count is 0', () => {
    render(<AverageRating average={0} count={0} />);
    expect(screen.getByTestId('average-rating-empty')).toBeInTheDocument();
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });

  it('rounds star display to nearest integer', () => {
    render(<AverageRating average={3.7} count={10} />);
    const ratingImg = screen.getByRole('img');
    // Math.round(3.7) = 4, so aria-label should show 4 out of 5
    expect(ratingImg).toHaveAttribute('aria-label', '4 out of 5 stars');
  });
});
