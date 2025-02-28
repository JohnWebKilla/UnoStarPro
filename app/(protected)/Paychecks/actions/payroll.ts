"use server";

import { generatePayroll } from "../lib/payroll-generator";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function generatePayrollAction(userId?: string) {
  try {
    await generatePayroll(userId);
    return { success: true, error: null };
  } catch (error) {
    console.error("Error in payroll generation:", error);
    return { success: false, error: "Failed to generate payroll" };
  }
}

export async function updateTransactionAction(
  transactionId: number,
  updateData: {
    status?: string;
    amount?: number;
    description?: string;
    transaction_date?: string;
  }
) {
  console.log("Updating transaction:", { transactionId, updateData });

  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user?.id) throw new Error("No authenticated user found");

    // Update the transaction
    const { data: updatedTransaction, error: updateError } = await supabase
      .from("payroll_transactions")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", transactionId)
      .select(
        `
        id,
        user_id,
        amount,
        transaction_date,
        status,
        transaction_type,
        description,
        created_by,
        created_at,
        updated_by,
        updated_at,
        user:user_id (
          first_name,
          last_name,
          email
        ),
        created_by_user:created_by (
          first_name,
          last_name,
          email
        ),
        updated_by_user:updated_by (
          first_name,
          last_name,
          email
        )
      `
      )
      .single();

    if (updateError) throw updateError;

    // Revalidate the path to update the UI
    revalidatePath("/Paychecks");

    return { success: true, data: updatedTransaction, error: null };
  } catch (error) {
    console.error("Error updating transaction:", error);
    return {
      success: false,
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to update transaction",
    };
  }
}
