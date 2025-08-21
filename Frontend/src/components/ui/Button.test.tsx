import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../utils/test-utils';
import Button from './Button';

describe('Button component', () => {
  it('renders with default text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Press</Button>);
    fireEvent.click(screen.getByRole('button', { name: /press/i }));
    expect(handleClick).toHaveBeenCalled();
  });

  it('displays loading state and disables button', () => {
    render(<Button isLoading>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/loading/i);
  });

  it('supports variants and size props', () => {
    render(
      <Button variant="primary" size="lg">
        Test
      </Button>
    );
    const btn = screen.getByRole('button', { name: /test/i });
    // primary adds 'bg-primary' and large adds 'text-lg'
    expect(btn).toHaveClass('bg-primary');
    expect(btn).toHaveClass('text-lg');
  });
});
