"use server";

import { createClient } from "@/utils/supabase/server";
import { PayrollSummary, PayrollTransaction } from "../types/payroll";

export async function calculateMonthlyPayroll(
  userId: string,
  month: number,
  year: number
) {
  const supabase = await createClient();

  // Get the date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    // Get base salary
    const { data: baseSalary } = await supabase
      .from("payroll_base")
      .select("base_salary")
      .eq("user_id", userId)
      .single();

    // Get all transactions for the month
    const { data: transactions } = await supabase
      .from("payroll_transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("transaction_date", startDate.toISOString())
      .lte("transaction_date", endDate.toISOString());

    // Get performance metrics
    const { data: metrics } = await supabase
      .from("performance_metrics")
      .select("*")
      .eq("user_id", userId)
      .gte("metric_date", startDate.toISOString())
      .lte("metric_date", endDate.toISOString());

    // Calculate totals
    const advances =
      transactions
        ?.filter((t) => t.transaction_type === "advance")
        .reduce((sum, t) => sum + t.amount, 0) ?? 0;

    const penalties =
      transactions
        ?.filter((t) => t.transaction_type === "penalty")
        .reduce((sum, t) => sum + t.amount, 0) ?? 0;

    const bonuses =
      transactions
        ?.filter((t) => t.transaction_type === "bonus")
        .reduce((sum, t) => sum + t.amount, 0) ?? 0;

    // Calculate performance metrics
    const ticketsClosed =
      metrics
        ?.filter((m) => m.metric_type === "tickets_closed")
        .reduce((sum, m) => sum + m.metric_value, 0) ?? 0;

    const shiftsCompleted =
      metrics
        ?.filter((m) => m.metric_type === "shifts_completed")
        .reduce((sum, m) => sum + m.metric_value, 0) ?? 0;

    const summary: PayrollSummary = {
      base_salary: baseSalary?.base_salary ?? 0,
      advances,
      penalties,
      bonuses,
      net_payable:
        (baseSalary?.base_salary ?? 0) + bonuses - advances - penalties,
      payment_period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      performance_metrics: {
        tickets_closed: ticketsClosed,
        shifts_completed: shiftsCompleted,
      },
    };

    return { summary, error: null };
  } catch (error) {
    console.error("Error calculating payroll:", error);
    return { summary: null, error: "Failed to calculate payroll" };
  }
}

export async function recordPayrollTransaction(
  transaction: Omit<PayrollTransaction, "id" | "created_at" | "updated_at">
) {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("payroll_transactions")
      .insert(transaction)
      .select()
      .single();

    if (error) throw error;
    return { transaction: data, error: null };
  } catch (error) {
    console.error("Error recording transaction:", error);
    return { transaction: null, error: "Failed to record transaction" };
  }
}
