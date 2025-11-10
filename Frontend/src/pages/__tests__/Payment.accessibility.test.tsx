import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../utils/test-utils';
import Payment from '../Payment';

// Mock api calls for orders & loyalty endpoints
vi.mock('../../api/api', () => ({
  __esModule: true,
  default: {
    interceptors: { request: { use: vi.fn(), eject: vi.fn() } },
    get: (url: string) => {
      if (url.startsWith('/orders/')) {
        return Promise.resolve({ data: { loyalty_eligible: true } });
      }
      if (url.startsWith('/loyalty/me')) {
        return Promise.resolve({ data: { rewards_ready: [{ reward: 'Full House Free Wash', expiry: new Date(Date.now()+86400000).toISOString(), milestone: 5 }] } });
      }
      return Promise.resolve({ data: {} });
    },
    post: vi.fn(() => Promise.resolve({ data: {} }))
  }
}));

// Mock AuthProvider to provide a user
vi.mock('../../auth/AuthProvider', async (orig) => {
  const actual: any = await (orig as any)();
  return {
    ...actual,
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAuth: () => ({ user: { id: 1, email: 'test@example.com', phone: '0123456789', role: 'user' }, loading: false, refreshUser: vi.fn() })
  };
});

// Stub Yoco SDK
// Augment window for test (no type strictness needed)
global.window.YocoSDK = function () { return { showPopup: vi.fn() }; } as any;

function setup() {
  const paymentState = {
    orderId: 'PAY123',
    total: 2599,
    summary: ['Deluxe Wash', 'Wax'],
    scheduledDate: new Date().toISOString(),
    scheduledTime: '10:30'
  } as any;
  return render(<Payment />, {
    routerProps: { initialEntries: [{ pathname: '/order/payment', state: paymentState }] }
  });
}

describe('Payment.accessibility', () => {
  it('renders amount, pay button and reward button', async () => {
    setup();
    // Amount display
    expect(await screen.findByText(/Amount due/i)).toBeInTheDocument();
    // Primary pay button
    const payBtn = await screen.findByTestId('pay-button');
    expect(payBtn).toBeEnabled();
    expect(payBtn).toHaveAttribute('aria-label');
    // Reward apply button
  const rewardBtn = await screen.findByTestId('apply-reward-button');
  // Reward button may start disabled while checking eligibility; presence & aria-label are sufficient
  expect(rewardBtn).toHaveAttribute('aria-label');
  });
});
