export interface Company {
  id: number;
  name: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  contact_phone: string;
  status: "active" | "inactive";
  stripe_customer_id?: string;
  stripe_subscription_id: string | null;
  stripe_payment_method_id: string | null;
  subscription_amount: number;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
  timezone: string;
  notifications_enabled: boolean;
  auto_invoice: boolean;
  default_payment_method?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details?: {
    address: {
      city: string;
      country: string;
      line1: string;
      line2: string;
      postal_code: string;
      state: string;
    };
    email: string;
    name: string;
    phone: string;
  };
  is_default: boolean;
}

export interface CompaniesApiResponse {
  data: Company[];
  source: "cache" | "database";
  timing?: {
    total: number;
    database?: number;
    source?: string;
  };
}

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Company;
  old: Company;
}

export interface CompanyMeta {
  onEdit: (company: Company) => void;
  onUpdateStatus: (company: Company) => void;
  onSyncStripe: (company: Company) => void;
  onStripeSettings: (company: Company) => void;
  onConnectStripe: (company: Company) => void;
  onRowClick: (company: Company) => void;
}
