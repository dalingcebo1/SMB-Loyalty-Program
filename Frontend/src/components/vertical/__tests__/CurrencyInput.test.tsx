import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CurrencyInput } from '../CurrencyInput';

describe('CurrencyInput', () => {
  it('renders with the formatted value', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={1234} onChange={onChange} label="Price" />);
    const input = screen.getByLabelText('Price');
    // The input should display 12.34 (1234 cents / 100)
    expect(input).toHaveValue(12.34);
  });

  it('calls onChange with cents when user types a value', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={0} onChange={onChange} />);
    const input = screen.getByLabelText('Currency amount');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25.50' } });

    // Should be called with 2550 cents
    expect(onChange).toHaveBeenCalledWith(2550);
  });

  it('displays the R prefix', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={5000} onChange={onChange} />);
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('shows formatted currency hint when value is positive and not focused', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value={5000} onChange={onChange} />);
    // formatCents(5000) → R 50,00 (en-ZA locale)
    const hint = screen.queryByText(/50/);
    expect(hint).toBeTruthy();
  });
});
