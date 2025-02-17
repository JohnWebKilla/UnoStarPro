import { createClient } from "@/utils/supabase/server";
import { calculateUserBonus } from "./bonus-calculator";

export async function generatePayroll(userId?: string) {
  const supabase = await createClient();

  try {
    // Get all active users or specific user
    const userQuery = supabase
      .from("users")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        role,
        status,
        company_id,
        payroll_base!inner (
          base_salary,
          currency,
          payment_frequency
        )
      `
      )
      .eq("status", "active");

    if (userId) {
      userQuery.eq("id", userId);
    }

    const { data: users, error: usersError } = await userQuery;
    if (usersError) throw usersError;

    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    // Process each user
    for (const user of users || []) {
      // Check if payroll already exists for this month
      const { data: existingPayroll } = await supabase
        .from("payroll_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("transaction_type", "payment")
        .gte("transaction_date", new Date(year, month - 1, 1).toISOString())
        .lte("transaction_date", new Date(year, month, 0).toISOString())
        .single();

      if (existingPayroll) {
        console.log(
          `Payroll already exists for user ${user.id} in ${month}/${year}`
        );
        continue;
      }

      // Calculate bonus
      const { bonusAmount } = await calculateUserBonus(user.id, month, year);

      // Create payroll transaction
      const { error: payrollError } = await supabase
        .from("payroll_transactions")
        .insert([
          {
            user_id: user.id,
            transaction_type: "payment",
            amount: user.payroll_base?.base_salary || 0,
            transaction_date: new Date().toISOString(),
            status: "pending",
            payment_period_start: new Date(year, month - 1, 1).toISOString(),
            payment_period_end: new Date(year, month, 0).toISOString(),
          },
        ]);

      if (payrollError) throw payrollError;

      // Create bonus transaction if applicable
      if (bonusAmount > 0) {
        const { error: bonusError } = await supabase
          .from("payroll_transactions")
          .insert([
            {
              user_id: user.id,
              transaction_type: "bonus",
              amount: bonusAmount,
              transaction_date: new Date().toISOString(),
              status: "pending",
              description: `Performance bonus for ${month}/${year}`,
            },
          ]);

        if (bonusError) throw bonusError;
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error generating payroll:", error);
    throw error;
  }
}
