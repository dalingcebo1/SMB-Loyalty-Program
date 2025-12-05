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
        // Return mocked order details matching the list data
        if (id === '2') {
          return Promise.resolve({ 
            data: { 
              id: '2', 
              amount: 22345, 
              status: 'pending', 
              service_name: 'Express Wash', 
              extras: [{ name: 'Wax' }, { name: 'Vacuum' }], 
              payment_pin: '8888' 
            } 
          });
        }
        // Default to order 1
        return Promise.resolve({ 
          data: { 
            id: '1', 
            amount: 12345, 
            status: 'completed', 
            service_name: 'Full Wash', 
            extras: [], 
            payment_pin: '9999' 
          } 
        });
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

// Helper to open modal for order matching summary/service text
async function openOrderModalBySummary(match: RegExp | string) {
  const rows = await screen.findAllByTestId('order-row');
  const targetRow = rows.find((row) =>
    within(row).queryByText(match)
  );

  if (!targetRow) {
    throw new Error(`No order row found matching ${match.toString()}`);
  }

  await act(async () => {
    fireEvent.click(targetRow);
  });
}

describe('PastOrders compact list', () => {
  it('renders compact list rows with minimal info', async () => {
    render(<PastOrders />);
  const list = await screen.findByRole('list');
  const items = within(list).getAllByTestId('order-row');
  expect(items.length).toBe(2);
    
    // Each row should show a total amount
    // Amounts use locale with comma decimal separator (123,45 or 223,45)
    // Intl for en-ZA may insert different types of whitespace (regular space, NBSP, etc.)
    // depending on Node.js version and ICU data. Check for currency amounts more flexibly:
    // Look for elements with aria-label="Total paid" that contain the amounts
    const amountElements = screen.getAllByLabelText(/Total paid/i);
    expect(amountElements).toHaveLength(2);
    
    // Verify the numeric values are present (flexible whitespace/formatting)
    const firstAmount = amountElements[0].textContent;
    const secondAmount = amountElements[1].textContent;
    
    // Should contain R (currency) and the numeric values (with comma decimal)
    expect(firstAmount).toMatch(/R.*123[.,]45/);
    expect(secondAmount).toMatch(/R.*223[.,]45/);
  });

  it('opens minimal modal with essential details', async () => {
    render(<PastOrders />);
    await openOrderModalBySummary(/Full Wash/i);
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
    await openOrderModalBySummary(/Express Wash/i);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByTestId('order-detail-table');
    // Extras row should list both extras joined by comma
    expect(within(dialog).getByText(/Extras/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Wax, Vacuum/i)).toBeInTheDocument();
  });
});
