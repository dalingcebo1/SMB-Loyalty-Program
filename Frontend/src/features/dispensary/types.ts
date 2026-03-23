/**
 * Shared types for the Dispensary vertical.
 */

export interface DispensaryCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  display_order: number;
  requires_medical_card: boolean;
  active: boolean;
}

export interface DispensaryCategoryCreate {
  name: string;
  description?: string;
  icon?: string;
  display_order?: number;
  requires_medical_card?: boolean;
  active?: boolean;
}

export type DispensaryCategoryUpdate = Partial<DispensaryCategoryCreate>;

export interface DispensaryProduct {
  id: number;
  category_id: number;
  name: string;
  strain?: string;
  strain_type?: 'indica' | 'sativa' | 'hybrid';
  description?: string;
  sku?: string;
  thc_percentage?: number;
  cbd_percentage?: number;
  terpenes?: string;
  effects?: string;
  medical_uses?: string;
  price_cents: number;
  unit_size: string;
  stock_quantity: number;
  batch_number?: string;
  harvest_date?: string;
  package_date?: string;
  expiry_date?: string;
  requires_medical_card: boolean;
  potency_level?: 'low' | 'medium' | 'high' | 'very_high';
  image_url?: string;
  featured: boolean;
  display_order: number;
  active: boolean;
}

export interface DispensaryProductCreate {
  category_id: number;
  name: string;
  strain?: string;
  strain_type?: 'indica' | 'sativa' | 'hybrid';
  description?: string;
  sku?: string;
  thc_percentage?: number;
  cbd_percentage?: number;
  terpenes?: string;
  effects?: string;
  medical_uses?: string;
  price_cents: number;
  unit_size: string;
  stock_quantity?: number;
  batch_number?: string;
  harvest_date?: string;
  package_date?: string;
  expiry_date?: string;
  requires_medical_card?: boolean;
  potency_level?: 'low' | 'medium' | 'high' | 'very_high';
  image_url?: string;
  featured?: boolean;
  display_order?: number;
  active?: boolean;
}

export type DispensaryProductUpdate = Partial<DispensaryProductCreate>;

export interface DispensaryVerification {
  id: number;
  customer_id: number;
  customer_name?: string;
  age_verified: boolean;
  has_medical_card: boolean;
  medical_card_number?: string;
  medical_card_expiry?: string;
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired';
  verified_by?: number;
  verification_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DispensaryPurchaseLimits {
  daily_limit_grams: number;
  monthly_limit_grams: number;
  daily_purchased_grams: number;
  monthly_purchased_grams: number;
  daily_remaining_grams: number;
  monthly_remaining_grams: number;
  can_purchase: boolean;
}

export interface DispensarySaleItem {
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
}

export interface DispensarySale {
  id: number;
  customer_id: number;
  customer_name?: string;
  staff_id?: number;
  staff_name?: string;
  total_amount_cents: number;
  tax_amount_cents: number;
  payment_method: string;
  transaction_reference?: string;
  status: string;
  items: DispensarySaleItem[];
  sale_date: string;
  created_at: string;
}
