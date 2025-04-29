import React from "react";

export type OrderSummary = {
  id: number;
  user_id: number;
  total_amount: number;
  status: string;
};

export const OrdersTable: React.FC<{
  orders: OrderSummary[];
  onSelect: (id: number) => void;
}> = ({ orders, onSelect }) => (
  <table>
    <thead>
      <tr>
        <th>Order ID</th>
        <th>User ID</th>
        <th>Total</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {orders.map((o) => (
        <tr key={o.id}>
          <td>{o.id}</td>
          <td>{o.user_id}</td>
          <td>${o.total_amount / 100}</td>
          <td>{o.status}</td>
          <td>
            <button onClick={() => onSelect(o.id)}>Open</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
