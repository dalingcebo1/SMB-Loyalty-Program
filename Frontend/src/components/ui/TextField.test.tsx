import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils/test-utils';
import TextField from './TextField';

describe('TextField component', () => {
  it('renders label and input', () => {
    render(<TextField label="Name" name="name" />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it('displays helper text when provided', () => {
    render(<TextField label="Age" name="age" helperText="Enter your age" />);
    expect(screen.getByText(/enter your age/i)).toBeInTheDocument();
  });

  it('shows error message and aria-invalid when error prop is set', () => {
    render(<TextField label="Email" name="email" error="Invalid email" />);
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid email/i);
  });
});
