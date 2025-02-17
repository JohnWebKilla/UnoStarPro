export interface PayrollBase {
  id: number;
  user_id: string;
  base_salary: number;
  currency: string;
  payment_frequency: "monthly" | "bi-weekly" | "weekly";
  created_at: string;
  updated_at: string;
}

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
}

export interface PerformanceMetric {
  id: number;
  user_id: string;
  metric_type: "tickets_closed" | "shifts_completed";
  metric_value: number;
  metric_date: string;
  created_at: string;
}

export interface BonusRule {
  id: number;
  rule_type: "tickets_threshold" | "shifts_completed";
  threshold_value: number;
  bonus_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollSummary {
  base_salary: number;
  advances: number;
  penalties: number;
  bonuses: number;
  net_payable: number;
  payment_period: {
    start: string;
    end: string;
  };
  performance_metrics: {
    tickets_closed: number;
    shifts_completed: number;
  };
}
