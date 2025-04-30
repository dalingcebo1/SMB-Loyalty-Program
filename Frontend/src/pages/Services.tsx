// Frontend/src/pages/Services.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../api/api';
import { Service, Extra, CartItem } from '../types';
import { useNavigate } from 'react-router-dom';

const Services: React.FC = () => {
  const [categories, setCategories] = useState<Record<string, Service[]>>({});
  const [extrasList, setExtrasList] = useState<Extra[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Record<string, Service[]>>('/catalog/services')
      .then((r) => setCategories(r.data))
      .catch((e) => console.error('Error loading services:', e));

    api.get<Extra[]>('/catalog/extras')
      .then((r) => setExtrasList(r.data))
      .catch((e) => console.error('Error loading extras:', e));
  }, []);

  const addToCart = (svc: Service) => {
    if (!selectedCat) {
      alert('Please pick a category first');
      return;
    }
    setCart((c) => [
      ...c,
      { service_id: svc.id, category: selectedCat, qty: 1, extras: [] },
    ]);
  };

  const toggleExtra = (idx: number, extraId: number) => {
    setCart((c) => {
      const newCart = [...c];
      const setExtras = new Set(newCart[idx].extras);
      if (setExtras.has(extraId)) setExtras.delete(extraId);
      else setExtras.add(extraId);
      newCart[idx].extras = Array.from(setExtras);
      return newCart;
    });
  };

  const goToCart = () => {
    // pass the cart along to /cart via state
    navigate('/cart', { state: { cart } });
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
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {selectedCat && (
        <>
          <h2>Services —</h2>
          <div>
            {categories[selectedCat].map((svc) => (
              <div
                key={svc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span>
                  {svc.name} — R{svc.base_price}
                </span>
                <button onClick={() => addToCart(svc)}>Add</button>
              </div>
            ))}
          </div>

          <h2>Your Cart & Extras</h2>
          {cart.map((item, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #ddd',
                padding: 12,
                marginBottom: 12,
              }}
            >
              <p>
                <strong>
                  Service #{item.service_id} (
                  {categories[selectedCat].find((s) => s.id === item.service_id)
                    ?.name}
                  )
                </strong>
              </p>
              <div>
                <p>Extras:</p>
                {extrasList.map((ext) => (
                  <label key={ext.id} style={{ display: 'block' }}>
                    <input
                      type="checkbox"
                      checked={item.extras.includes(ext.id)}
                      onChange={() => toggleExtra(idx, ext.id)}
                    />{' '}
                    {ext.name} (+R{ext.price_map[item.category] ?? 0})
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button onClick={goToCart} style={{ marginTop: 16 }}>
            Review Cart & Pay
          </button>
        </>
      )}
    </div>
  );
};

export default Services;
