/**
 * Shared types for the Retail vertical.
 */

export interface RetailProduct {
  id: number;
  sku: string;
  name: string;
  description?: string;
  cost_cents: number;
  price_cents: number;
  margin: number;
  barcode?: string;
  low_stock_threshold?: number;
  is_active: boolean;
  category?: { id: number; name: string };
  supplier?: { id: number; name: string };
  inventory_levels: {
    location: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
  }[];
  low_stock_alerts: LowStockAlert[];
}

export interface RetailProductCreate {
  sku: string;
  name: string;
  description?: string;
  cost_cents: number;
  price_cents: number;
  barcode?: string;
  low_stock_threshold?: number;
  is_active?: boolean;
  category_id?: number;
  supplier_id?: number;
}

export type RetailProductUpdate = Partial<RetailProductCreate>;

export interface RetailCategory {
  id: number;
  name: string;
}

export interface RetailSupplier {
  id: number;
  name: string;
}

export interface RetailInventoryStats {
  total_products: number;
  low_stock_count: number;
  total_inventory_value_cents: number;
  total_suppliers: number;
  total_categories: number;
}

export interface LowStockAlert {
  id: number;
  product: {
    id: number;
    sku: string;
    name: string;
    category?: { name: string };
  };
  inventory_level: { location: string };
  threshold: number;
  current_quantity: number;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
}

export interface RetailSaleItem {
  id: number;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
}

export interface RetailPayment {
  id: number;
  payment_method: string;
  amount_cents: number;
  change_given_cents: number;
  status: string;
  created_at: string;
}

export interface RetailSale {
  id: number;
  receipt_number: string;
  location: string;
  customer_id?: number;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  sale_status: string;
  payment_status: string;
  created_at: string;
  completed_at?: string;
  items: RetailSaleItem[];
  sale_payments: RetailPayment[];
}

export interface RetailSalesStats {
  total_sales: number;
  total_revenue_cents: number;
  average_sale_cents: number;
  sales_today: number;
  revenue_today_cents: number;
}
