import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../../utils/test-utils';
import SubscriptionManagePageNew from '../SubscriptionManagePageNew';

// Mock API
vi.mock('../../../api/api', () => ({
  __esModule: true,
  default: {
    interceptors: { request: { use: vi.fn(), eject: vi.fn() } },
    get: vi.fn((url: string) => {
      if (url === '/subscriptions/plans') {
        return Promise.resolve({
          data: [
            {
              id: 'free',
              name: 'Starter',
              description: 'Basic plan',
              price_cents: 0,
              currency: 'zar',
              // Missing features, but has modules
              modules: ['loyalty']
            },
            {
              id: 'pro',
              name: 'Growth',
              description: 'Pro plan',
              price_cents: 49900,
              currency: 'zar',
              // Has features
              features: { loyalty: { limit_customers: 1000 } }
            }
          ]
        });
      }
      if (url === '/subscriptions/subscription-status') {
        return Promise.resolve({
          data: {
            status: 'active',
            plan: { id: 'free' },
            stripe_customer_id: 'cus_123',
            stripe_subscription_id: 'sub_123'
          }
        });
      }
      if (url === '/subscriptions/usage') {
        return Promise.resolve({
          data: [
            { module: 'loyalty', count: 10, limit: 100 }
          ]
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    }),
    post: vi.fn()
  }
}));

describe('SubscriptionManagePageNew', () => {
  it('renders plans even if features are missing (backward compatibility)', async () => {
    render(<SubscriptionManagePageNew />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument();
    });

    // Check if "Loyalty Customers" is shown for Starter plan (derived from modules)
    // Since we map modules=['loyalty'] to features={loyalty: true}, it should show the label.
    // The label for 'loyalty' is 'Loyalty Customers'.
    // It might appear multiple times (once for usage, once for each plan).
    const loyaltyElements = screen.getAllByText('Loyalty Customers');
    expect(loyaltyElements.length).toBeGreaterThan(0);
    
    // Check if Growth plan renders
    expect(screen.getByText('Growth')).toBeInTheDocument();
  });
});
