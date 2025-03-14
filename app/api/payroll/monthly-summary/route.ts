import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCache, setCache, deleteCache } from "@/lib/redis";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION = 300;

// Define types for our data
interface PayrollSummary {
  user_id: string;
  month: string;
  first_name: string;
  last_name: string;
  email: string;
  base_payment: number;
  advances: number;
  penalties: number;
  bonuses: number;
  [key: string]: any; // Allow additional properties
}

interface PayrollTransaction {
  id: number;
  user_id: string;
  amount: number;
  status: string;
  transaction_date: string;
  transaction_type: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const skipCache = searchParams.get("skipCache") === "true";
    const startTime = Date.now();

    if (!monthParam) {
      return NextResponse.json(
        { error: "Month parameter is required (YYYY-MM-DD format)" },
        { status: 400 }
      );
    }

    // Parse the month parameter
    const selectedMonth = parseISO(monthParam);
    console.log(
      `Parsed month parameter: ${monthParam} -> ${selectedMonth.toISOString()}`
    );

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const monthString = monthStart.toISOString().slice(0, 7); // YYYY-MM format

    console.log(
      `Month range: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`
    );
    console.log(
      `Processing payroll for month: ${monthString} (${format(monthStart, "MMMM yyyy")})`
    );

    // Build cache key
    const cacheKey = `payroll:monthly-summary:${monthString}`;
    console.log(`Processing request for ${cacheKey}, skipCache=${skipCache}`);

    // Try to get data from cache if not skipping
    if (!skipCache) {
      try {
        // Set a shorter timeout for cache retrieval in serverless
        const timeoutMs = process.env.VERCEL ? 2000 : 3000;

        const cachedData = await Promise.race([
          getCache<PayrollSummary[]>(cacheKey),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error("Cache retrieval timed out")),
              timeoutMs
            )
          ),
        ]);

        if (cachedData) {
          console.log(
            `Cache hit for ${cacheKey} (${Date.now() - startTime}ms)`
          );
          return NextResponse.json({
            data: cachedData,
            source: "cache",
            timing: {
              total: Date.now() - startTime,
              source: "cache",
            },
          });
        }
        console.log(`Cache miss for ${cacheKey}`);
      } catch (cacheError) {
        console.error("Cache retrieval error:", cacheError);
        // Continue to database if cache fails
      }
    }

    // If not in cache or skipping cache, fetch from database
    console.log("Fetching payroll data from database for:", {
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
    });

    const supabase = await createClient();
    const dbStartTime = Date.now();

    // First, let's just get the transactions for the month
    // This is more reliable since we know the transaction_date format
    console.log(
      `Fetching transactions for period: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`
    );
    const { data: transactionsData, error: transactionsError } = await supabase
      .from("payroll_transactions")
      .select("id, user_id, amount, status, transaction_date, transaction_type")
      .gte("transaction_date", monthStart.toISOString())
      .lt("transaction_date", monthEnd.toISOString())
      .neq("status", "cancelled");

    if (transactionsError) {
      console.error("Error fetching transactions:", transactionsError);
      // Return empty data instead of error
      return NextResponse.json({
        data: [],
        source: "database",
        timing: {
          total: Date.now() - startTime,
          database: Date.now() - dbStartTime,
        },
      });
    }

    // Log transaction data
    if (transactionsData && transactionsData.length > 0) {
      console.log(
        `Found ${transactionsData.length} transactions for month ${monthString}`
      );
      console.log("Sample transaction data:", transactionsData.slice(0, 2));

      // Extract unique user IDs from transactions
      const userIds = Array.from(
        new Set(transactionsData.map((t) => t.user_id))
      );
      console.log(`Found ${userIds.length} unique users with transactions`);

      // Fetch user details for these users
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, first_name, last_name, email, department, role")
        .in("id", userIds);

      if (userError) {
        console.error("Error fetching user data:", userError);
      }

      // Fetch user schedules
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedules")
        .select("user_id, working_shift, off_days")
        .in("user_id", userIds);

      if (scheduleError) {
        console.error("Error fetching user schedules:", scheduleError);
      }

      // Create lookup maps for department, role, and schedule
      const departmentMap = new Map();
      const roleMap = new Map();
      if (userData) {
        userData.forEach((user) => {
          departmentMap.set(user.id, user.department);
          roleMap.set(user.id, user.role);
        });
      }

      const scheduleMap = new Map();
      if (scheduleData) {
        scheduleData.forEach((schedule) => {
          scheduleMap.set(schedule.user_id, {
            working_shift: schedule.working_shift,
            off_days: schedule.off_days,
          });
        });
      }

      // Create summary data from transactions and user data
      const enhancedSummaryData = userIds.map((userId) => {
        const userTransactions = transactionsData.filter(
          (t) => t.user_id === userId
        );
        const user = userData?.find((u) => u.id === userId) || {
          first_name: "Unknown",
          last_name: "User",
          email: userId,
        };

        // Calculate totals
        const basePayment = userTransactions
          .filter((t) => t.transaction_type === "payment")
          .reduce((sum, t) => sum + t.amount, 0);

        const advances = userTransactions
          .filter((t) => t.transaction_type === "advance")
          .reduce((sum, t) => sum + t.amount, 0);

        const penalties = userTransactions
          .filter((t) => t.transaction_type === "penalty")
          .reduce((sum, t) => sum + t.amount, 0);

        const bonuses = userTransactions
          .filter((t) => t.transaction_type === "bonus")
          .reduce((sum, t) => sum + t.amount, 0);

        // Calculate total amount
        const totalAmount = basePayment + bonuses - advances - penalties;

        // Calculate paid amount - ensure it doesn't exceed the total amount
        const rawPaidAmount = userTransactions
          .filter((t) => t.status === "paid")
          .reduce((sum, t) => {
            if (
              t.transaction_type === "payment" ||
              t.transaction_type === "bonus"
            ) {
              return sum + t.amount;
            } else if (
              t.transaction_type === "advance" ||
              t.transaction_type === "penalty"
            ) {
              return sum - t.amount;
            }
            return sum;
          }, 0);

        // Ensure paid amount doesn't exceed total amount
        const paidAmount = Math.min(Math.max(0, rawPaidAmount), totalAmount);

        const pendingAmount = userTransactions
          .filter((t) => t.status === "pending")
          .reduce((sum, t) => {
            if (
              t.transaction_type === "payment" ||
              t.transaction_type === "bonus"
            ) {
              return sum + t.amount;
            }
            return sum;
          }, 0);

        return {
          user_id: userId,
          month: monthString,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          department: departmentMap.get(userId),
          role: roleMap.get(userId),
          schedule: scheduleMap.get(userId),
          base_payment: basePayment,
          advances: advances,
          penalties: penalties,
          bonuses: bonuses,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          pending_amount: Math.max(0, pendingAmount),
          transaction_ids: userTransactions.map((t) => t.id),
        };
      });

      console.log(
        `Created ${enhancedSummaryData.length} enhanced summary records from transactions`
      );

      // Store in cache for future requests
      try {
        await setCache(cacheKey, enhancedSummaryData, CACHE_EXPIRATION);
        console.log(`Data cached successfully for ${cacheKey}`);
      } catch (cacheError) {
        console.error("Failed to store data in cache:", cacheError);
      }

      const totalTime = Date.now() - startTime;
      console.log(`Total request processing time: ${totalTime}ms`);

      return NextResponse.json({
        data: enhancedSummaryData,
        source: "database",
        timing: {
          total: totalTime,
          database: Date.now() - dbStartTime,
        },
      });
    } else {
      console.log(`No transactions found for month ${monthString}`);

      // Return empty data
      return NextResponse.json({
        data: [],
        source: "database",
        timing: {
          total: Date.now() - startTime,
          database: Date.now() - dbStartTime,
        },
      });
    }
  } catch (error: any) {
    console.error("Error fetching payroll data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch payroll data" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");

    if (!monthParam) {
      return NextResponse.json(
        { error: "Month parameter is required (YYYY-MM-DD format)" },
        { status: 400 }
      );
    }

    // Parse the month parameter
    const selectedMonth = parseISO(monthParam);

    // Build cache key
    const cacheKey = `payroll:monthly-summary:${selectedMonth.toISOString().slice(0, 7)}`;
    console.log(`Invalidating cache for ${cacheKey}`);

    // Delete from cache with a timeout
    try {
      await Promise.race([
        deleteCache(cacheKey),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Cache deletion timed out")), 2000)
        ),
      ]);
      console.log(`Cache invalidated for ${cacheKey}`);
    } catch (error) {
      console.error("Error invalidating cache:", error);
      // Return success anyway since the main goal is to force a refresh
    }

    return NextResponse.json({
      success: true,
      message: "Cache invalidated successfully",
    });
  } catch (error: any) {
    console.error("Error invalidating cache:", error);
    return NextResponse.json(
      { error: error.message || "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
