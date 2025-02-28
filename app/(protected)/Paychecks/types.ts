export type TransactionType = "payment" | "advance" | "penalty" | "bonus";
export type PaymentStatus =
  | "pending"
  | "paid"
  | "unpaid"
  | "charged"
  | "deducted";

export interface Schedule {
  working_shift: string;
  shift_name?: string;
  off_days?: string[];
}

export interface PayrollTransaction {
  id: number;
  user_id: string;
  transaction_type: TransactionType;
  amount: number;
  description?: string;
  transaction_date: string;
  status: PaymentStatus;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;

  // User information (joined from users table)
  first_name?: string;
  last_name?: string;
  email?: string;

  // Nested user object from join
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };

  // Created by user information
  created_by_user?: {
    first_name: string;
    last_name: string;
    email: string;
  };

  // Updated by user information
  updated_by_user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface MonthlyPayrollSummary {
  user_id: string;
  month: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  role?: string;
  schedule?: Schedule;
  base_payment: number;
  advances: number;
  penalties: number;
  bonuses: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  transaction_ids?: number[];
  pending_penalties?: number;
  deducted_penalties?: number;
}

export type OverallStatus = "paid" | "pending" | "partially_paid" | "unpaid";

export function getOverallStatus(
  summary: MonthlyPayrollSummary
): OverallStatus {
  if (summary.total_amount <= 0) return "paid";
  if (summary.paid_amount >= summary.total_amount) return "paid";
  if (summary.paid_amount > 0) return "partially_paid";
  if (summary.pending_amount > 0) return "pending";
  return "unpaid";
}

export function getStatusBadgeClass(status: OverallStatus): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "partially_paid":
      return "bg-blue-100 text-blue-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "unpaid":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
