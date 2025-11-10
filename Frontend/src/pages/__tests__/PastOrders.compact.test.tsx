import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '../../utils/test-utils';
import { act } from 'react-dom/test-utils';

// Mock API client with minimal axios-like surface (interceptors + get)
vi.mock('../../api/api', () => ({
  __esModule: true,
  default: {
    interceptors: { request: { use: vi.fn(), eject: vi.fn() } },
    get: (url: string) => {
      if (url.startsWith('/orders/my-past-orders')) {
        return Promise.resolve({
          data: [
            { id: '1', created_at: new Date().toISOString(), amount: 12345, status: 'completed', service_name: 'Full Wash', extras: [] },
            { id: '2', created_at: new Date().toISOString(), amount: 22345, status: 'pending', service_name: 'Express Wash', extras: [{ name: 'Wax' }, { name: 'Vacuum' }] }
          ]
        });
      }
      if (url.startsWith('/orders/')) {
        const id = url.split('/').pop();
        return Promise.resolve({ data: { id, amount: 12345, status: 'completed', service_name: id === '2' ? 'Express Wash' : 'Full Wash', extras: id === '2' ? [{ name: 'Wax' }, { name: 'Vacuum' }] : [], payment_pin: '9999' } });
      }
      return Promise.resolve({ data: [] });
    }
  }
}));

// Silence toast + provide stub ToastContainer used by test-utils
vi.mock('react-toastify', async (orig) => {
  const actual: any = await (orig as any)();
  return {
    ...actual,
    ToastContainer: () => <div data-testid="toast-root" />,
    toast: { error: vi.fn(), success: vi.fn() },
  };
});

// Stub QRCode to avoid SVG complexity
vi.mock('react-qr-code', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => <div data-testid="qr">QR:{value}</div>
}));

// Minimal router context
vi.mock('react-router-dom', async (orig) => {
  const actual: any = await (orig as any)();
  return { ...actual, useNavigate: () => vi.fn() };
});

import PastOrders from '../PastOrders';

// Helper to open first order modal
async function openFirstModal() {
  const rows = await screen.findAllByTestId('order-row');
  await act(async () => {
    fireEvent.click(rows[0]);
  });
}

describe('PastOrders compact list', () => {
  it('renders compact list rows with minimal info', async () => {
    render(<PastOrders />);
  const list = await screen.findByRole('list');
  const items = within(list).getAllByTestId('order-row');
  expect(items.length).toBe(2);
    // Each row should show a total amount
  // Amounts use locale with comma decimal separator
  // Intl for en-ZA inserts a non-breaking space (\u00A0) after the currency symbol.
  // Match either regular whitespace or NBSP to avoid brittle failures.
  expect(screen.getByText(/R[\s\u00A0]*123,45/)).toBeInTheDocument();
  expect(screen.getByText(/R[\s\u00A0]*223,45/)).toBeInTheDocument();
  });

  it('opens minimal modal with essential details', async () => {
    render(<PastOrders />);
    await openFirstModal();
    const dialog = await screen.findByRole('dialog');

    // Wait for detail-table test id signaling loaded content (not skeleton)
    await within(dialog).findByTestId('order-detail-table');
    // Ensure loading text gone
    expect(within(dialog).queryByText(/Loading order details/i)).toBeNull();
    // PIN label should now be present
  expect(within(dialog).getByText(/^PIN$/i)).toBeInTheDocument();
  // Modal title (h2) should contain summary
  expect(within(dialog).getByRole('heading', { level: 2, name: /Full Wash/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/Total Paid/i)).toBeInTheDocument();
    expect(within(dialog).getByTestId('qr')).toBeInTheDocument();
  });

  it('renders extras for an order that has them', async () => {
    render(<PastOrders />);
    // Click the second row (has extras)
    const rows = await screen.findAllByTestId('order-row');
    await act(async () => fireEvent.click(rows[1]));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByTestId('order-detail-table');
    // Extras row should list both extras joined by comma
    expect(within(dialog).getByText(/Extras/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Wax, Vacuum/i)).toBeInTheDocument();
  });
});
