import React from "react";

export type CartItem = {
  serviceId: number;
  name: string;
  price: number;
  qty: number;
};

export const CartSummary: React.FC<{
  items: CartItem[];
  onRemove: (serviceId: number) => void;
}> = ({ items, onRemove }) => {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return (
    <div>
      <h2>Cart</h2>
      <ul>
        {items.map((i) => (
          <li key={i.serviceId}>
            {i.name} x{i.qty} — ${(i.price * i.qty) / 100}{" "}
            <button onClick={() => onRemove(i.serviceId)}>Remove</button>
          </li>
        ))}
      </ul>
      <p>Total: ${total / 100}</p>
    </div>
  );
};
