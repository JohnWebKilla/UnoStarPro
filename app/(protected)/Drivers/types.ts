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
  id: string;
  name: string;
  phone: string;
  phone_number?: string; // Legacy field
  truckNumber: string;
  truck_number?: string; // Legacy field
  type: "solo" | "team";
  solo_or_team?: string; // Legacy field
  status: "active" | "inactive" | "terminated" | "pending";
  documents: {
    id: string;
    name: string;
    url: string;
    expiryDate?: string;
  }[];
  driver_licenses?: Document[];
  medical_cards?: Document[];
  mvr_files?: Document[];
  subscription: {
    id: string;
    status: "connected" | "disconnected";
    amount: number;
    info?: string;
  };
  subscription_amount?: number; // Legacy field
  subscription_frequency?: SubscriptionFrequency;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  stripe_connect_account_id?: string | null;
  company_id?: number;
  company_name?: string;
  companies?: {
    id: number;
    name: string;
  };
  hire_date?: string;
  terminated_date?: string | null;
  createdAt: string;
  updatedAt: string;
  created_at?: string; // Legacy field
  updated_at?: string; // Legacy field
}

// Driver status options
export const DRIVER_STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Terminated",
  "Pending",
] as const;

// Driver team options
export const DRIVER_TEAM_OPTIONS = ["Solo", "Team"] as const;

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

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Driver;
  old: Driver;
}
