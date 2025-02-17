export interface PayrollTransaction {
  id: number;
  user_id: string;
  transaction_type: "payment" | "advance" | "penalty" | "bonus";
  amount: number;
  description?: string;
  transaction_date: string;
  payment_period_start?: string;
  payment_period_end?: string;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  // Fields from users table
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  user_status: string;
}
