export interface Company {
  id: number;
  name: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_payment_method_id?: string;
  subscription_amount?: number;
  status?: string;
  last_synced_at?: string;
  auto_invoice?: boolean;
  created_at?: string;
  updated_at?: string;
}
