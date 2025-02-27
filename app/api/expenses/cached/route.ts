import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCache, setCache, deleteCache } from "@/lib/redis";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION = 300;

// Define types for our data
interface Expense {
  id: number;
  category_id: number;
  expense_categories: {
    name: string;
  };
  amount: number;
  currency: "USD" | "UZS";
  amount_uzs: number | null;
  exchange_rate: number | null;
  description: string | null;
  expense_date: string;
  payment_status: "pending" | "paid" | "cancelled";
  payment_method: string | null;
  receipt_url: string | null;
  created_by_user?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  updated_by_user?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skipCacheParam = searchParams.get("skipCache");

    // Add detailed logging for debugging
    console.log(
      `[DEBUG] Raw skipCache parameter: "${skipCacheParam}", type: ${typeof skipCacheParam}`
    );

    // Fix: Properly convert string to boolean - handle different string values
    const skipCache = skipCacheParam === "true";

    console.log(
      `[DEBUG] Converted skipCache value: ${skipCache}, type: ${typeof skipCache}`
    );

    const monthParam = searchParams.get("month");
    const userId = searchParams.get("userId");
    const requestId = searchParams.get("requestId") || "unknown";
    const startTime = Date.now();

    console.log(`[${requestId}] API Request received with params:`, {
      skipCacheParam,
      skipCache,
      monthParam,
      userId,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    });

    if (!monthParam) {
      return NextResponse.json(
        { error: "Month parameter is required (YYYY-MM-DD format)" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Parse the month parameter
    const selectedMonth = parseISO(monthParam);
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    // Build cache key
    const cacheKey = `expenses:${userId}:${monthStart.toISOString().slice(0, 7)}`;
    console.log(
      `[${requestId}] Processing request for ${cacheKey}, skipCache=${skipCache}, skipCacheParam=${skipCacheParam}, timestamp=${new Date().toISOString()}`
    );

    // Try to get data from cache if not skipping
    if (!skipCache) {
      try {
        // Set a shorter timeout for cache retrieval in serverless
        const timeoutMs = process.env.VERCEL ? 2000 : 3000;

        console.log(
          `[${requestId}] Attempting to retrieve data from cache with key: ${cacheKey}`
        );
        const cachedData = await Promise.race([
          getCache<Expense[]>(cacheKey),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error("Cache retrieval timed out")),
              timeoutMs
            )
          ),
        ]);

        if (cachedData) {
          console.log(
            `[${requestId}] Cache hit for ${cacheKey} (${Date.now() - startTime}ms), timestamp=${new Date().toISOString()}, returning ${cachedData.length} records`
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
        console.log(
          `[${requestId}] Cache miss for ${cacheKey}, timestamp=${new Date().toISOString()}`
        );
      } catch (cacheError) {
        console.error(`[${requestId}] Cache retrieval error:`, cacheError);
        // Continue to database if cache fails
      }
    } else {
      console.log(
        `[${requestId}] Skipping cache for ${cacheKey} due to skipCache=${skipCache}, skipCacheParam=${skipCacheParam}, timestamp=${new Date().toISOString()}`
      );
    }

    // If not in cache or skipping cache, fetch from database
    console.log(`[${requestId}] Fetching expenses data from database for:`, {
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
      userId,
    });

    const supabase = await createClient();
    const dbStartTime = Date.now();

    // First, ensure payroll expenses are up to date
    await supabase.rpc("sync_monthly_payroll", {
      month_date: monthStart.toISOString(),
      user_id: userId,
    });

    // Then fetch all expenses including payroll
    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select(
        `
        *,
        expense_categories (name),
        created_by_user:users(email, first_name, last_name),
        updated_by_user:users(email, first_name, last_name)
      `
      )
      .gte("expense_date", monthStart.toISOString())
      .lt("expense_date", monthEnd.toISOString())
      .order("expense_date", { ascending: false });

    if (expensesError) {
      console.error(`[${requestId}] Database error:`, expensesError);
      return NextResponse.json(
        { error: "Failed to fetch expenses" },
        { status: 500 }
      );
    }

    const formattedData =
      expensesData?.map((expense) => ({
        ...expense,
        amount:
          typeof expense.amount === "string"
            ? parseFloat(expense.amount)
            : expense.amount,
      })) || [];

    const dbTime = Date.now() - dbStartTime;
    console.log(
      `[${requestId}] Database fetch completed in ${dbTime}ms, retrieved ${formattedData.length} records`
    );

    // Store in cache for future requests
    try {
      await setCache(cacheKey, formattedData, CACHE_EXPIRATION);
      console.log(
        `[${requestId}] Cached data for ${cacheKey}, expiration: ${CACHE_EXPIRATION}s`
      );
    } catch (cacheError) {
      console.error(`[${requestId}] Cache storage error:`, cacheError);
      // Continue even if caching fails
    }

    return NextResponse.json({
      data: formattedData,
      source: "database",
      timing: {
        total: Date.now() - startTime,
        database: dbTime,
      },
    });
  } catch (error) {
    console.error("Error in expenses/cached route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const userId = searchParams.get("userId");
    const requestId = searchParams.get("requestId") || "unknown";

    console.log(`[${requestId}] Cache invalidation request received:`, {
      monthParam,
      userId,
      url: request.url,
    });

    if (!monthParam || !userId) {
      return NextResponse.json(
        { error: "Month and userId parameters are required" },
        { status: 400 }
      );
    }

    // Parse the month parameter
    const selectedMonth = parseISO(monthParam);
    const monthStart = startOfMonth(selectedMonth);

    // Build cache key
    const cacheKey = `expenses:${userId}:${monthStart.toISOString().slice(0, 7)}`;
    console.log(`[${requestId}] Invalidating cache for key: ${cacheKey}`);

    await deleteCache(cacheKey);
    console.log(
      `[${requestId}] Cache invalidated successfully for ${cacheKey}`
    );

    return NextResponse.json({
      message: `Cache invalidated for ${cacheKey}`,
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
    return NextResponse.json(
      { error: "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
