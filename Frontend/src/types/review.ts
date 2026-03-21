/** Types for the customer reviews system. */

export interface ReviewCreate {
  appointment_id: number;
  overall_rating: number;
  service_quality_rating: number;
  stylist_rating: number;
  cleanliness_rating: number;
  value_rating: number;
  review_title?: string;
  review_text?: string;
}

export interface ReviewResponse {
  id: number;
  appointment_id: number;
  customer_id: number;
  customer_name: string;
  service_id: number;
  service_name: string;
  stylist_id: number;
  stylist_name: string;
  overall_rating: number;
  service_quality_rating: number;
  stylist_rating: number;
  cleanliness_rating: number;
  value_rating: number;
  average_rating: number;
  review_title?: string;
  review_text?: string;
  approved: boolean;
  featured: boolean;
  created_at: string;
}

export interface AverageRatingData {
  average: number;
  count: number;
}
