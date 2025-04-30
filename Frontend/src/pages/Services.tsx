// Frontend/src/pages/Services.tsx
import React, { useEffect, useState } from 'react';
import { Service, Extra, CartItem } from '../types';
import { api } from '../api/api';

const Services: React.FC = () => {
  const [cats, setCats] = useState<Record<string,Service[]>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [pickedExtras, setPickedExtras] = useState<number[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  // fetch services & extras once
  useEffect(() => {
    api.get('/catalog/services').then(r => {
      setCats(r.data);
      // pick first category by default
      const firstCat = Object.keys(r.data)[0];
      setSelectedCat(firstCat);
    });
    api.get('/catalog/extras').then(r => setExtras(r.data));
  }, []);

  const toggleExtra = (id: number) => {
    setPickedExtras(xs =>
      xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id]
    );
  };

  const addToCart = (svc: Service) => {
    const item: CartItem = {
      service_id: svc.id,
      category: selectedCat,
      qty: 1,
      extras: pickedExtras,
    };
    const next = [...cart, item];
    setCart(next);
    localStorage.setItem('cart', JSON.stringify(next));
    // reset extras picks
    setPickedExtras([]);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Choose your wash</h2>
      <div style={{ marginBottom: 20 }}>
        {Object.keys(cats).map(cat => (
          <button
            key={cat}
            style={{
              marginRight: 8,
              fontWeight: cat === selectedCat ? 'bold' : 'normal',
            }}
            onClick={() => {
              setSelectedCat(cat);
              setPickedExtras([]);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List services for selected category */}
      {cats[selectedCat]?.map(svc => (
        <div
          key={svc.id}
          style={{
            border: '1px solid #ddd',
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <strong>{svc.name}</strong> — R{svc.base_price}
          </div>
          <div style={{ marginBottom: 8 }}>
            <em>Select extras:</em>
            <div>
              {extras.map(ex => (
                <label key={ex.id} style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={pickedExtras.includes(ex.id)}
                    onChange={() => toggleExtra(ex.id)}
                  />{' '}
                  {ex.name} (+R{ex.price_map[selectedCat] ?? 0})
                </label>
              ))}
            </div>
          </div>
          <button onClick={() => addToCart(svc)}>
            Add to cart
          </button>
        </div>
      ))}

      <div style={{ marginTop: 24 }}>
        <button onClick={() => (window.location.href = '/cart')}>
          View Cart ({cart.length})
        </button>
      </div>
    </div>
  );
};

export default Services;
