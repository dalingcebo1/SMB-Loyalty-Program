import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../utils/test-utils';
import StarRating from '../StarRating';

describe('StarRating', () => {
  it('renders 5 stars by default', () => {
    render(<StarRating value={3} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('aria-label', '3 out of 5 stars');
  });

  it('renders the correct number of filled stars', () => {
    const { container } = render(<StarRating value={3} />);
    const spans = container.querySelectorAll('span.star-rating > span');
    // First 3 should be filled (amber), last 2 unfilled (gray)
    const colors = Array.from(spans).map((s) => (s as HTMLElement).style.color);
    expect(colors.filter((c) => c === 'rgb(245, 158, 11)')).toHaveLength(3);
    expect(colors.filter((c) => c === 'rgb(209, 213, 219)')).toHaveLength(2);
  });

  it('renders interactive radio buttons when onChange is provided', () => {
    const handleChange = vi.fn();
    render(<StarRating value={2} onChange={handleChange} />);
    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
  });

  it('calls onChange with the selected star value', () => {
    const handleChange = vi.fn();
    render(<StarRating value={2} onChange={handleChange} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[3]); // click 4th star
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it('marks the current value as aria-checked', () => {
    render(<StarRating value={3} onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).toHaveAttribute('aria-checked', 'true');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('supports custom max and size', () => {
    const { container } = render(<StarRating value={2} max={3} size={32} />);
    const spans = container.querySelectorAll('span.star-rating > span');
    expect(spans).toHaveLength(3);
    expect((spans[0] as HTMLElement).style.fontSize).toBe('32px');
  });
});
