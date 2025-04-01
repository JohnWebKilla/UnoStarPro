// Types for Driver-related data

// Document types
export interface Document {
  id: number;
  driver_id: number;
  expiration_date: string;
  file_name?: string;
  file_url?: string;
  license_file_url?: string;
  file_link?: string;
  mvr_file_url?: string;
  status?: string;
  url?: string;
  created_at: string;
  updated_at: string;
}

// Driver type
export interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: string;
  status: string;
  driver_licenses: Document[];
  medical_cards: Document[];
  mvr_files: Document[];
  company_id: number;
  company_name?: string;
  subscription_amount: number;
  subscription_frequency: SubscriptionFrequency;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_connect_account_id: string | null;
  hire_date: string;
  terminated_date: string | null;
  created_at: string;
  updated_at: string;
  companies?: {
    id: number;
    name: string;
  };
}

// Driver status options
export const DRIVER_STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Terminated",
  "Pending",
];

// Driver team options
export const DRIVER_TEAM_OPTIONS = ["Solo", "Team"];

// Subscription frequency options
export const SUBSCRIPTION_FREQUENCY_OPTIONS = ["weekly", "monthly"] as const;
export type SubscriptionFrequency =
  (typeof SUBSCRIPTION_FREQUENCY_OPTIONS)[number];

// Cache-related response types
export interface CacheResponse<T> {
  data: T;
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source: "client-cache" | "server" | "local-storage";
  };
}
