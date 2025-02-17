"use server";

import { generatePayroll } from "../lib/payroll-generator";

export async function generatePayrollAction(userId?: string) {
  try {
    await generatePayroll(userId);
    return { success: true, error: null };
  } catch (error) {
    console.error("Error in payroll generation:", error);
    return { success: false, error: "Failed to generate payroll" };
  }
}
