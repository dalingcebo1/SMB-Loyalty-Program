// Frontend/src/pages/Services.tsx
import React, { useEffect, useState } from 'react';
import api from '../api/api';
import { Service, Extra, CartItem } from '../types';

export const Services: React.FC = () => {
  const [categories, setCategories] = useState<Record<string, Service[]>>({});
  const [extrasList, setExtrasList] = useState<Extra[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');

  useEffect(() => {
    // load services, group by category
    api
      .get<Service[]>('/catalog/services')
      .then((res) => {
        const grouped = res.data.reduce((acc: Record<string, Service[]>, svc) => {
          acc[svc.category] = acc[svc.category] || [];
          acc[svc.category].push(svc);
          return acc;
        }, {});
        setCategories(grouped);
      })
      .catch((err) => console.error('Error loading services:', err));

    // load extras
    api
      .get<Extra[]>('/catalog/extras')
      .then((res) => setExtrasList(res.data))
      .catch((err) => console.error('Error loading extras:', err));
  }, []);

  const addToCart = (svc: Service) => {
    setCart((prev) => [
      ...prev,
      { service_id: svc.id, category: selectedCat, qty: 1, extras: [] },
    ]);
  };

  const toggleExtra = (itemIdx: number, extraId: number) => {
    setCart((prev) => {
      const copy = [...prev];
      const e = copy[itemIdx].extras;
      copy[itemIdx].extras = e.includes(extraId)
        ? e.filter((x) => x !== extraId)
        : [...e, extraId];
      return copy;
    });
  };

  const goToCart = () => {
    localStorage.setItem('cart', JSON.stringify(cart));
    // assuming you have a /cart route
    window.location.href = '/cart';
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Pick a Category</h1>
      <select
        value={selectedCat}
        onChange={(e) => setSelectedCat(e.target.value)}
      >
        <option value="">-- select --</option>
        {Object.keys(categories).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {selectedCat && (
        <div style={{ marginTop: 24 }}>
          {categories[selectedCat].map((svc) => (
            <div key={svc.id} style={{ marginBottom: 16 }}>
              <strong>
                {svc.name} — R{svc.base_price}
              </strong>
              <button
                style={{ marginLeft: 12 }}
                onClick={() => addToCart(svc)}
              >
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2>Customize Extras</h2>
          {cart.map((item, idx) => {
            const svc = categories[item.category].find((s) => s.id === item.service_id);
            return (
              <div key={idx} style={{ marginBottom: 24 }}>
                <h3>{svc?.name}</h3>
                {extrasList.map((ext) => (
                  <label key={ext.id} style={{ display: 'block', margin: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={item.extras.includes(ext.id)}
                      onChange={() => toggleExtra(idx, ext.id)}
                    />{' '}
                    {ext.name} (+R{ext.price_map[item.category] ?? 0})
                  </label>
                ))}
              </div>
            );
          })}

          <button onClick={goToCart} style={{ marginTop: 16 }}>
            Review Cart & Pay
          </button>
        </div>
      )}
    </div>
  );
};
