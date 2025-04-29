export type Service = {
  id: number;
  name: string;
  base_price: number;
};

export type Extra = {
  id: number;
  name: string;
  price_map: Record<string, number>;
};
