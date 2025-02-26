import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCache, setCache, deleteCache } from "@/lib/redis";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

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

    if (!monthParam) {
      return NextResponse.json(
        { error: "Month parameter is required (YYYY-MM-DD format)" },
        { status: 400 }
      );
    }

    // Parse the month parameter
    const selectedMonth = parseISO(monthParam);
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    // Build cache key
    const cacheKey = `payroll:monthly-summary:${monthStart.toISOString().slice(0, 7)}`;

    // Try to get data from cache if not skipping
    if (!skipCache) {
      try {
        // Set a timeout for cache retrieval
        const cachedData = await Promise.race([
          getCache<PayrollSummary[]>(cacheKey),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error("Cache retrieval timed out")),
              3000
            )
          ),
        ]);

        if (cachedData) {
          console.log("Payroll data retrieved from Redis cache");
          return NextResponse.json({
            data: cachedData,
            source: "cache",
          });
        }
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

    // First get the monthly summary with a timeout
    const summaryPromise = supabase.from("monthly_payroll_summary").select("*");

    const summaryResponse = (await Promise.race([
      summaryPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database query timed out")), 5000)
      ),
    ])) as { data: PayrollSummary[] | null; error: any };

    const { data: summaryData, error: summaryError } = summaryResponse;

    if (summaryError) {
      console.error("Supabase error:", summaryError);
      return NextResponse.json(
        { error: summaryError.message },
        { status: 500 }
      );
    }

    if (!summaryData) {
      console.error("No summary data returned from database");
      return NextResponse.json({ error: "No data found" }, { status: 404 });
    }

    // Then get the transactions for the selected month with a timeout
    const transactionsPromise = supabase
      .from("payroll_transactions")
      .select("id, user_id, amount, status, transaction_date, transaction_type")
      .gte("transaction_date", monthStart.toISOString())
      .lt("transaction_date", monthEnd.toISOString())
      .neq("status", "cancelled");

    const transactionsResponse = (await Promise.race([
      transactionsPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database query timed out")), 5000)
      ),
    ])) as { data: PayrollTransaction[] | null; error: any };

    const { error: transactionsError } = transactionsResponse;
    let transactionsData = transactionsResponse.data || [];

    if (transactionsError) {
      console.error("Supabase error:", transactionsError);
      return NextResponse.json(
        { error: transactionsError.message },
        { status: 500 }
      );
    }

    // Calculate total and paid amounts
    const combinedData = summaryData.map((summary: PayrollSummary) => {
      const transactions = transactionsData.filter(
        (t: PayrollTransaction) => t.user_id === summary.user_id
      );

      // Calculate base total first
      const baseTotal = summary.base_payment;

      // Handle different transaction types
      const {
        paidAmount,
        pendingAmount,
        pendingPenalties,
        deductedPenalties,
        totalBonuses,
        totalAdvances,
        totalPenalties,
      } = transactions.reduce(
        (
          acc: {
            paidAmount: number;
            pendingAmount: number;
            pendingPenalties: number;
            deductedPenalties: number;
            totalBonuses: number;
            totalAdvances: number;
            totalPenalties: number;
          },
          t: PayrollTransaction
        ) => {
          const amount = t.amount;
          switch (t.transaction_type) {
            case "bonus":
              acc.totalBonuses += amount;
              if (t.status === "paid") acc.paidAmount += amount;
              if (t.status === "pending") acc.pendingAmount += amount;
              break;
            case "penalty":
              if (t.status === "charged") {
                acc.totalPenalties += amount;
                acc.paidAmount -= amount;
              }
              if (t.status === "pending") acc.pendingPenalties += amount;
              break;
            case "advance":
              acc.totalAdvances += amount;
              if (t.status === "paid") {
                acc.paidAmount -= amount;
              }
              if (t.status === "pending") acc.pendingAmount += amount;
              break;
            case "payment":
              if (t.status === "paid") acc.paidAmount += amount;
              if (t.status === "pending") acc.pendingAmount += amount;
              break;
          }
          return acc;
        },
        {
          paidAmount: 0,
          pendingAmount: 0,
          pendingPenalties: 0,
          deductedPenalties: 0,
          totalBonuses: 0,
          totalAdvances: 0,
          totalPenalties: 0,
        }
      );

      // Final total calculation:
      // base + bonuses - (advances + penalties)
      const total = baseTotal + totalBonuses - totalAdvances - totalPenalties;

      return {
        ...summary,
        transaction_ids: transactions.map((t: PayrollTransaction) => t.id),
        total_amount: total,
        paid_amount: Math.max(0, paidAmount),
        pending_amount: Math.max(0, pendingAmount),
        pending_penalties: pendingPenalties,
        deducted_penalties: deductedPenalties,
      };
    });

    // Store in cache for future requests
    try {
      // Set a timeout for cache storage
      await Promise.race([
        setCache(cacheKey, combinedData, CACHE_EXPIRATION),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Cache storage timed out")), 3000)
        ),
      ]);
    } catch (cacheError) {
      console.error("Failed to store data in cache:", cacheError);
      // Continue even if caching fails
    }

    return NextResponse.json({
      data: combinedData,
      source: "database",
    });
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

    // Delete from cache with a timeout
    try {
      await Promise.race([
        deleteCache(cacheKey),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Cache deletion timed out")), 3000)
        ),
      ]);
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
