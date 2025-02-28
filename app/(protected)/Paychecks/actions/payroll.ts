"use server";

import { generatePayroll } from "../lib/payroll-generator";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
} from "date-fns";

export async function generatePayrollAction(userId?: string) {
  try {
    await generatePayroll(userId);
    return { success: true, error: null };
  } catch (error) {
    console.error("Error in payroll generation:", error);
    return { success: false, error: "Failed to generate payroll" };
  }
}

interface CustomPayrollParams {
  userIds: string[];
  periodStart: string;
  periodEnd: string;
  isFullMonth: boolean;
}

export async function generateCustomPayrollAction(params: CustomPayrollParams) {
  console.log("Generating custom payroll with params:", params);

  try {
    const supabase = await createClient();
    const { userIds, periodStart, periodEnd, isFullMonth } = params;

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user?.id) throw new Error("No authenticated user found");

    // Fetch users with their base salary, role, and department
    console.log(`Fetching ${userIds.length} users for payroll generation`);

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, role, department")
      .in("id", userIds)
      .eq("status", "active");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${users.length} active users`);

    // Now fetch their base salaries from payroll_base table
    const { data: payrollBaseData, error: payrollBaseError } = await supabase
      .from("payroll_base")
      .select("user_id, base_salary, payment_frequency")
      .in("user_id", userIds);

    if (payrollBaseError) {
      console.error("Error fetching payroll base data:", payrollBaseError);
      throw payrollBaseError;
    }

    console.log(`Found ${payrollBaseData?.length || 0} payroll base records`);

    // Create a map of base salaries by user ID
    const baseSalaryMap = new Map();
    payrollBaseData?.forEach((record) => {
      baseSalaryMap.set(record.user_id, {
        base_salary: record.base_salary,
        payment_frequency: record.payment_frequency,
      });
    });

    // Combine user data with base salary
    const usersWithSalary = users
      .map((user) => ({
        ...user,
        base_salary: baseSalaryMap.get(user.id)?.base_salary || 0,
        payment_frequency:
          baseSalaryMap.get(user.id)?.payment_frequency || "monthly",
      }))
      .filter((user) => user.base_salary > 0);

    // Log the users found
    console.log(
      `Found ${usersWithSalary.length} users with base salary for payroll generation:`,
      usersWithSalary.map((u) => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        role: u.role,
        department: u.department,
        base_salary: u.base_salary,
      }))
    );

    if (usersWithSalary.length === 0) {
      throw new Error("No users with base salary found");
    }

    console.log(`${usersWithSalary.length} users have base salary configured`);

    // Calculate working days for prorated payments
    const calculateWorkingDays = (start: Date, end: Date) => {
      const days = eachDayOfInterval({ start, end });
      return days.filter((day) => !isWeekend(day)).length;
    };

    // Process each user
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const transactions = [];

    for (const user of usersWithSalary) {
      let amount = user.base_salary;

      // If not full month, calculate prorated amount
      if (!isFullMonth) {
        const monthStart = startOfMonth(startDate);
        const monthEnd = endOfMonth(startDate);
        const workingDaysInMonth = calculateWorkingDays(monthStart, monthEnd);
        const workingDaysInPeriod = calculateWorkingDays(startDate, endDate);

        // Calculate daily rate and prorated amount
        const dailyRate = user.base_salary / workingDaysInMonth;
        amount = dailyRate * workingDaysInPeriod;

        console.log(
          `Prorated calculation for ${user.first_name} ${user.last_name}:`,
          {
            baseSalary: user.base_salary,
            workingDaysInMonth,
            workingDaysInPeriod,
            dailyRate,
            proratedAmount: amount,
          }
        );
      }

      // Create transaction object
      const transaction = {
        user_id: user.id,
        transaction_type: "payment",
        amount: amount,
        description: isFullMonth
          ? `Monthly salary for ${startDate.toLocaleString("default", { month: "long", year: "numeric" })}`
          : `Salary for period ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        transaction_date: new Date().toISOString(),
        payment_period_start: startDate.toISOString(),
        payment_period_end: endDate.toISOString(),
        status: "pending",
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      console.log(
        `Creating transaction for ${user.first_name} ${user.last_name} (${user.role}${user.department ? ` - ${user.department}` : ""}):`,
        {
          amount: transaction.amount,
          description: transaction.description,
        }
      );

      transactions.push(transaction);
    }

    // Insert transactions
    if (transactions.length === 0) {
      console.log("No transactions to insert");
      return {
        success: true,
        count: 0,
        error: null,
      };
    }

    console.log(`Inserting ${transactions.length} transactions`);
    const { data: insertedData, error: insertError } = await supabase
      .from("payroll_transactions")
      .insert(transactions)
      .select();

    if (insertError) {
      console.error("Error inserting transactions:", insertError);
      throw insertError;
    }

    console.log(
      `Successfully created ${insertedData.length} payroll transactions`
    );

    // Revalidate the path to update the UI
    revalidatePath("/Paychecks");

    return {
      success: true,
      count: transactions.length,
      error: null,
    };
  } catch (error) {
    console.error("Error generating custom payroll:", error);
    return {
      success: false,
      count: 0,
      error:
        error instanceof Error ? error.message : "Failed to generate payroll",
    };
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
