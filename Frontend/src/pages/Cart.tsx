// Frontend/src/pages/Cart.tsx
import React, { useState, useEffect } from 'react';
import { CartItem, Service, Extra } from '../types';
import api from '../api/api';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

const Cart: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [services, setServices] = useState<Record<string,Service[]>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) setCart(JSON.parse(stored));

    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/catalog/services'),
      api.get('/catalog/extras')
    ])
      .then(([svcRes, exRes]) => {
        setServices(svcRes.data);
        setExtras(exRes.data);
      })
      .catch((err) => setError('Failed to load cart data.'))
      .finally(() => setLoading(false));
  }, []);

  // lookup helpers
  const findService = (id: number) =>
    Object.values(services)
      .flat()
      .find(s => s.id === id);
  const findExtra = (id: number) =>
    extras.find(e => e.id === id);

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

  if (loading) {
    return <Loading text="Loading cart..." />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;
  }
  return (
    <div style={{ padding: 20 }}>
      <h2>Your Cart</h2>
      {cart.map((item, i) => {
        const svc = findService(item.service_id)!;
        return (
          <div key={i} style={{ marginBottom: 16 }}>
            <div>
              <strong>{svc.name}</strong> × {item.qty} — R
              {svc.base_price * item.qty}
            </div>
            {item.extras.length > 0 && (
              <ul style={{ marginLeft: 20 }}>
                {item.extras.map(eid => {
                  const ex = findExtra(eid)!;
                  const price = ex.price_map[item.category] || 0;
                  return (
                    <li key={eid}>
                      {ex.name} (+R{price} each)
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      <h3>Total: R{grandTotal}</h3>

      <button onClick={() => (window.location.href = '/payment')}>
        Proceed to Payment
      </button>
    </div>
  );
};

export default Cart;