// Frontend/src/pages/Payment.tsx
import React, { useState, useEffect } from 'react';
import { CartItem } from '../types';
import  api  from '../api/api';

const Payment: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('cart');
    if (stored) setCart(JSON.parse(stored));
  }, []);

  const handlePay = async () => {
    try {
      const r = await api.post('/orders/orders', { items: cart });
      // redirect to paystack checkout URL returned by backend
      window.location.href = r.data.checkout_url;
    } catch (err) {
      console.error(err);
      alert('Payment initialization failed');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Confirm & Pay</h2>
      <button onClick={handlePay}>Pay Now</button>
    </div>
  );
};

export default Payment;
