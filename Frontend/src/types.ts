// Frontend/src/types.ts
export interface Service {
  id: number;
  name: string;
  base_price: number;
}

export interface Extra {
  id: number;
  name: string;
  // map category name → extra price
  price_map: Record<string, number>;
}

export interface CartItem {
  service_id: number;
  category: string;
  qty: number;
  extras: number[];
}
