import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../utils/test-utils';
import OrderConfirmation from '../OrderConfirmation';

// Mock dependencies that perform network calls
vi.mock('../../api/api', () => ({
  __esModule: true,
  default: {
    interceptors: { request: { use: vi.fn(), eject: vi.fn() } },
    get: (url: string) => {
      if (url.startsWith('/orders/')) {
        return Promise.resolve({
          data: {
            status: 'paid',
            amount: 12345,
            serviceName: 'Full Wash',
            extras: ['Wax'],
            visits: 4,
            nextMilestone: 5,
            upcomingRewards: [{ milestone: 5, visits_needed: 1, reward: 'Free Wax' }]
          }
        });
      }
      return Promise.resolve({ data: {} });
    }
  }
}));

// Mock QRCode to keep DOM simple
vi.mock('react-qr-code', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => <div data-testid="mock-qr">QR:{value}</div>
}));

// Mock AuthProvider downstream calls (interceptor + /auth/me) to avoid network
vi.mock('../../auth/AuthProvider', async (orig) => {
  const actual: any = await (orig as any)();
  return {
    ...actual,
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAuth: () => ({ user: { id: 1, email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'user' }, loading: false })
  };
});

// Provide initial route state using MemoryRouter
function setup() {
  const orderState = {
    orderId: 'ABC123',
    qrData: 'ABC123',
    amount: 12345,
    paymentPin: '9999',
    summary: ['Full Wash', 'Wax'],
    status: 'paid',
    timestamp: Date.now()
  } as any;
  // Use test-utils routerProps to inject location state without creating nested routers
  return render(<OrderConfirmation />, {
    routerProps: { initialEntries: [{ pathname: '/confirm/ABC123', state: orderState }] }
  });
}

describe('OrderConfirmation accessibility & content', () => {
  it('renders status, amount, pin, qr and summary sections', async () => {
    setup();
    // Status
    const status = await screen.findByTestId('order-confirmation-status');
    expect(status).toHaveAttribute('role', 'status');
    // Amount
    expect(await screen.findByTestId('amount-paid')).toBeInTheDocument();
    // PIN
    expect(await screen.findByTestId('payment-pin')).toHaveTextContent('9999');
    // QR
    expect(await screen.findByTestId('payment-qr')).toBeInTheDocument();
    expect(screen.getByTestId('mock-qr')).toHaveTextContent('QR:ABC123');
    // Summary items
    expect(screen.getByText(/Full Wash/i)).toBeInTheDocument();
  // Use getAllByText because 'Wax' appears in summary and upcoming reward description
  const waxMatches = screen.getAllByText(/Wax/i);
  expect(waxMatches.length).toBeGreaterThanOrEqual(1);
  });
});
