import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils/test-utils';
import Select from './Select';

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
];

describe('Select component', () => {
  it('renders label and options', () => {
    render(<Select label="Choose" options={options} />);
    expect(screen.getByLabelText(/choose/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /option a/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /option b/i })).toBeInTheDocument();
  });

  it('displays helper text when provided', () => {
    render(
      <Select label="Choose" options={options} helperText="Select an option" />
    );
    expect(screen.getByText(/select an option/i)).toBeInTheDocument();
  });

  it('shows error state when error prop is set', () => {
    render(<Select label="Choose" options={options} error="Required" />);
    const select = screen.getByLabelText(/choose/i);
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });
});
