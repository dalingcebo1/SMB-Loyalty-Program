// Frontend/src/pages/Cart.tsx
import React, { useState, useEffect } from 'react';
import { CartItem, Service, Extra } from '../types';
import  api  from '../api/api';

const Cart: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [services, setServices] = useState<Record<string,Service[]>>({});
  const [extras, setExtras] = useState<Extra[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) setCart(JSON.parse(stored));

    api.get('/catalog/services').then(r => setServices(r.data));
    api.get('/catalog/extras').then(r => setExtras(r.data));
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