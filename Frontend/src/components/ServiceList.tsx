import React from "react";

export type Service = {
  id: number;
  name: string;
  base_price: number;
};

export const ServiceList: React.FC<{
  services: Service[];
  onAdd: (service: Service) => void;
}> = ({ services, onAdd }) => (
  <ul>
    {services.map((s) => (
      <li key={s.id}>
        ${s.base_price / 100} — {s.name}{" "}
        <button onClick={() => onAdd(s)}>Add to Cart</button>
      </li>
    ))}
  </ul>
);
