import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../utils/test-utils';
import ReviewForm from '../ReviewForm';

describe('ReviewForm', () => {
  it('renders all five rating categories', () => {
    render(<ReviewForm onSubmit={vi.fn()} />);
    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByText('Service quality')).toBeInTheDocument();
    expect(screen.getByText('Stylist')).toBeInTheDocument();
    expect(screen.getByText('Cleanliness')).toBeInTheDocument();
    expect(screen.getByText('Value for money')).toBeInTheDocument();
  });

  it('renders title and comment fields', () => {
    render(<ReviewForm onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText('Summarise your experience')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Tell others/)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<ReviewForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /submit review/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting without ratings', () => {
    const handleSubmit = vi.fn();
    render(<ReviewForm onSubmit={handleSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/please provide a rating/i);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with values when all ratings are provided', () => {
    const handleSubmit = vi.fn();
    render(<ReviewForm onSubmit={handleSubmit} />);

    // Click the 4th star in each of the 5 rating groups
    const radioGroups = screen.getAllByRole('radiogroup');
    expect(radioGroups).toHaveLength(5);
    radioGroups.forEach((group) => {
      const radios = group.querySelectorAll('[role="radio"]');
      fireEvent.click(radios[3]); // 4th star = value 4
    });

    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));
    expect(handleSubmit).toHaveBeenCalledTimes(1);

    const values = handleSubmit.mock.calls[0][0];
    expect(values.overall_rating).toBe(4);
    expect(values.service_quality_rating).toBe(4);
    expect(values.stylist_rating).toBe(4);
    expect(values.cleanliness_rating).toBe(4);
    expect(values.value_rating).toBe(4);
    expect(values.review_title).toBe('');
    expect(values.review_text).toBe('');
  });

  it('disables the submit button when submitting', () => {
    render(<ReviewForm onSubmit={vi.fn()} submitting />);
    expect(screen.getByRole('button', { name: /submit review/i })).toBeDisabled();
  });
});
