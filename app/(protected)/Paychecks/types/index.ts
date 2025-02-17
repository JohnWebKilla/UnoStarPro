import { User } from "@/app/(protected)/Users/types";

export interface PayrollTransaction {
  id: number;
  user_id: string;
  user: User;
  transaction_type: "payment" | "advance" | "penalty" | "bonus";
  amount: number;
  description?: string;
  transaction_date: string;
  payment_period_start?: string;
  payment_period_end?: string;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}
