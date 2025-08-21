// Frontend/src/pages/Cart.tsx
import React from 'react';
import { useServices, useExtras } from '../api/queries';
import Container from '../components/ui/Container';
import Button from '../components/ui/Button';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import PageLayout from '../components/PageLayout';
import { CartItem } from '../types';


const Cart: React.FC = () => {
  // Cart items from localStorage
  const cart: CartItem[] = JSON.parse(localStorage.getItem('cart') || '[]');

  // Data fetching via React Query
  const { data: services = {}, isLoading: loadingSvc, error: errorSvc } = useServices();
  const { data: extras = [], isLoading: loadingEx, error: errorEx } = useExtras();

  const loading = loadingSvc || loadingEx;
  const error = errorSvc || errorEx;

  // lookup helpers
  const allServices = Object.values(services).flat();
  const findService = (id: number) => allServices.find(s => s.id === id)!;
  const findExtra = (id: number) => extras.find(e => e.id === id)!;
  // compute grand total
  const grandTotal = cart.reduce((sum, item) => {
    const svc = findService(item.service_id)!;
    const svcTotal = svc.base_price * item.qty;
    const extrasTotal = item.extras.reduce((esum, eid) => {
      const ex = findExtra(eid)!;
      const price = ex.price_map[item.category] || 0;
      return esum + price * item.qty;
    }, 0);
    return sum + svcTotal + extrasTotal;
  }, 0);

  if (loading) return <Loading text="Loading cart..." />;
  if (error) return <ErrorMessage message="Failed to load cart data." onRetry={() => window.location.reload()} />;

  return (
    <PageLayout>
      <Container>
        <div className="py-6">
          <h2 className="text-xl font-semibold mb-4">Your Cart</h2>
          {cart.map((item, i) => {
            const svc = findService(item.service_id)!;
            return (
              <div key={i} className="mb-4">
                <div className="flex justify-between">
                  <span><strong>{svc.name}</strong> × {item.qty}</span>
                  <span>R{svc.base_price * item.qty}</span>
                </div>
                {item.extras.length > 0 && (
                  <ul className="ml-4 list-disc">
                    {item.extras.map(eid => {
                      const ex = findExtra(eid)!;
                      const price = ex.price_map[item.category] || 0;
                      return <li key={eid}>{ex.name} (+R{price} each)</li>;
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="flex justify-between items-center mt-6">
            <h3 className="text-lg font-semibold">Total: R{grandTotal}</h3>
            <Button onClick={() => window.location.href = '/payment'}>Proceed to Payment</Button>
          </div>
        </div>
      </Container>
    </PageLayout>
  );
};
export default Cart;