import { describe, it, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen } from '../../utils/test-utils';
import Checkbox from './Checkbox';

describe('Checkbox component', () => {
  it('renders label and unchecked by default', () => {
    render(<Checkbox label="Agree" name="agree" />);
    const checkbox = screen.getByRole('checkbox', { name: /agree/i });
    expect(checkbox).toBeInTheDocument();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('toggles checked state on click', () => {
    render(<Checkbox label="Terms" name="terms" />);
    const checkbox = screen.getByRole('checkbox', { name: /terms/i });
    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it('displays helper text when provided', () => {
    render(
      <Checkbox label="Notify" name="notify" helperText="Weekly updates" />
    );
    expect(screen.getByText(/weekly updates/i)).toBeInTheDocument();
  });

  it('shows error message and aria-invalid when error prop is set', () => {
    render(<Checkbox label="Accept" name="accept" error="Required" />);
    const checkbox = screen.getByRole('checkbox', { name: /accept/i });
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });
});
