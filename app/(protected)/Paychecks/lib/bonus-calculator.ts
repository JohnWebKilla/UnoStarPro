import { createClient } from "@/utils/supabase/server";

export async function calculateUserBonus(
  userId: string,
  month: number,
  year: number
) {
  const supabase = await createClient();

  // Get the date range for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    // Get tickets closed in the month
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("*")
      .eq("closed_by", userId)
      .gte("closed_time", startDate.toISOString())
      .lte("closed_time", endDate.toISOString());

    if (ticketsError) throw ticketsError;

    // Get bonus rules
    const { data: rules, error: rulesError } = await supabase
      .from("bonus_rules")
      .select("*")
      .eq("rule_type", "tickets_threshold")
      .eq("is_active", true)
      .order("threshold_value", { ascending: false });

    if (rulesError) throw rulesError;

    const ticketCount = tickets?.length || 0;
    let bonusAmount = 0;

    // Find the highest threshold met
    const applicableRule = rules?.find(
      (rule) => ticketCount >= rule.threshold_value
    );
    if (applicableRule) {
      bonusAmount = applicableRule.bonus_amount;
    }

    return { bonusAmount, ticketCount };
  } catch (error) {
    console.error("Error calculating bonus:", error);
    throw error;
  }
}
