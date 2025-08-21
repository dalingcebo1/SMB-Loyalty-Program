import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../utils/test-utils';
import RadioGroup from './RadioGroup';

const options = [
  { label: 'Alpha', value: 'alpha' },
  { label: 'Beta', value: 'beta' },
];

describe('RadioGroup component', () => {
  it('renders options and respects selectedValue', () => {
    render(
      <RadioGroup name="test" options={options} selectedValue="beta" onChange={() => {}} />
    );
    expect(screen.getByRole('radio', { name: /alpha/i })).toBeInTheDocument();
    expect((screen.getByRole('radio', { name: /beta/i }) as HTMLInputElement).checked).toBe(true);
  });

  it('calls onChange when clicking an option', () => {
    const handleChange = vi.fn();
    render(
      <RadioGroup name="test" options={options} selectedValue="alpha" onChange={handleChange} direction="row" />
    );
    fireEvent.click(screen.getByRole('radio', { name: /beta/i }));
    expect(handleChange).toHaveBeenCalledWith('beta');
  });
});
