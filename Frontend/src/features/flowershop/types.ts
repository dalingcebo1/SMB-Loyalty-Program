/**
 * Shared types for the Flowershop vertical.
 */

export interface FlowershopCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  display_order: number;
  active: boolean;
}

export interface FlowershopOccasion {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color_scheme?: string;
  active: boolean;
}

export interface FlowershopProduct {
  id: number;
  category_id: number;
  name: string;
  description?: string;
  sku?: string;
  price_cents: number;
  sale_price_cents?: number;
  stock_quantity: number;
  track_inventory: boolean;
  low_stock_threshold: number;
  size?: string;
  color_scheme?: string;
  includes_vase: boolean;
  includes_card: boolean;
  image_url?: string;
  featured: boolean;
  seasonal: boolean;
  active: boolean;
  available_for_delivery: boolean;
  available_for_pickup: boolean;
  occasions: FlowershopOccasion[];
}

export interface FlowershopProductCreate {
  category_id: number;
  name: string;
  description?: string;
  sku?: string;
  price_cents: number;
  sale_price_cents?: number;
  stock_quantity?: number;
  track_inventory?: boolean;
  low_stock_threshold?: number;
  size?: string;
  color_scheme?: string;
  includes_vase?: boolean;
  includes_card?: boolean;
  image_url?: string;
  featured?: boolean;
  seasonal?: boolean;
  active?: boolean;
  available_for_delivery?: boolean;
  available_for_pickup?: boolean;
}

export type FlowershopProductUpdate = Partial<FlowershopProductCreate>;

export interface FlowershopOrderItem {
  product_id: number;
  quantity: number;
}

export interface FlowershopCartItem extends FlowershopOrderItem {
  product: FlowershopProduct;
}
