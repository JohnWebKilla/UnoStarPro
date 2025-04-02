"use client";

import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";
import { format, parseISO } from "date-fns";

// Define the Expense type
export interface Expense {
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

// Define response type for cached data
export interface ExpensesApiResponse {
  data: Expense[];
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source?: "client-cache" | "server" | "local-storage";
  };
}

// Define chart data point interface
export interface ChartDataPoint {
  date: string;
  total: number;
  payroll: number;
  other: number;
}

// Define response type for chart data
export interface ChartDataApiResponse {
  data: ChartDataPoint[];
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source?: "client-cache" | "server" | "local-storage";
  };
}

// Get expenses with multi-layer caching
export async function getMonthlyExpenses(
  selectedMonth: Date,
  userId: string,
  supabase: any,
  skipCache: boolean = false
): Promise<ExpensesApiResponse> {
  const startTime = performance.now();
  const monthStart = new Date(selectedMonth);
  monthStart.setDate(1); // Start of month
  const monthEnd = new Date(selectedMonth);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0); // End of month

  const monthKey = format(monthStart, "yyyy-MM");
  const cacheKey = `expenses:${monthKey}:${userId}`;

  console.log(`Fetching expenses for ${monthKey}, skipCache: ${skipCache}`);

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      // Directly check localStorage first as it's the fastest option
      try {
        const localData = localStorage.getItem(cacheKey);
        if (localData) {
          const parsedData = JSON.parse(localData);
          // Ensure parsed data is an array
          const dataArray = Array.isArray(parsedData) ? parsedData : [];

          // Check if data is fresh (less than 5 minutes old)
          const timestamp = localStorage.getItem(`${cacheKey}:timestamp`);
          const dataAge = timestamp
            ? Date.now() - parseInt(timestamp, 10)
            : Infinity;

          if (dataAge < 5 * 60 * 1000) {
            // 5 minutes
            const endTime = performance.now();
            console.log("Using expenses data from localStorage cache");
            // No delay - immediate return for better performance
            return {
              data: dataArray,
              source: "cache",
              timing: {
                total: endTime - startTime,
                source: "local-storage",
              },
            };
          }
        }
      } catch (e) {
        // Silently continue if localStorage access fails
        console.log("localStorage access failed, continuing to API cache");
      }

      // Only check API cache if localStorage failed or had stale data
      try {
        const result = await getClientCache(
          "expenses:" + monthKey + ":" + userId
        );
        if (result.data) {
          // Ensure result.data is an array
          const dataArray = Array.isArray(result.data) ? result.data : [];

          // Update localStorage for next time
          try {
            localStorage.setItem(cacheKey, JSON.stringify(dataArray));
            localStorage.setItem(
              `${cacheKey}:timestamp`,
              Date.now().toString()
            );
          } catch (e) {
            console.error("Error saving to localStorage:", e);
          }

          const endTime = performance.now();
          console.log("Using expenses data from client API cache");
          return {
            data: dataArray,
            source: "cache",
            timing: {
              total: endTime - startTime,
              source: "client-cache",
            },
          };
        }
      } catch (cacheError) {
        console.error("Client API cache error:", cacheError);
      }
    } catch (cacheError) {
      console.error("Client cache error:", cacheError);
      // Continue to server fetch if cache fails
    }
  }

  // Fetch from API
  const dbStartTime = performance.now();
  try {
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

    if (expensesError) throw expensesError;

    // Ensure data is properly formatted
    const formattedData =
      expensesData?.map((expense: any) => ({
        ...expense,
        amount:
          typeof expense.amount === "string"
            ? parseFloat(expense.amount)
            : expense.amount,
      })) || [];

    // Cache the data
    // Try to cache the data on client-side
    try {
      // Cache in API
      await setClientCache(cacheKey, formattedData, 300);

      // Also cache in localStorage for faster retrieval next time
      try {
        localStorage.setItem(cacheKey, JSON.stringify(formattedData));
        localStorage.setItem(`${cacheKey}:timestamp`, Date.now().toString());
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    } catch (cacheError) {
      console.error("Failed to set client cache:", cacheError);
    }

    const endTime = performance.now();
    console.log(`Expenses data loaded from API in ${endTime - dbStartTime}ms`);

    return {
      data: formattedData,
      source: "database",
      timing: {
        total: endTime - startTime,
        database: endTime - dbStartTime,
        source: "server",
      },
    };
  } catch (error) {
    console.error("Error fetching expenses:", error);
    const endTime = performance.now();

    return {
      data: [],
      source: "database",
      timing: {
        total: endTime - startTime,
        database: endTime - dbStartTime,
        source: "server",
      },
    };
  }
}

// Get chart data with multi-layer caching
export async function getExpensesChartData(
  dateRange: { start: Date; end: Date },
  userId: string,
  supabase: any,
  skipCache: boolean = false
): Promise<ChartDataApiResponse> {
  const startTime = performance.now();
  const cacheKey = `expenses:chart:${format(dateRange.start, "yyyy-MM")}:${format(dateRange.end, "yyyy-MM")}:${userId}`;

  console.log(`Fetching chart data for date range, skipCache: ${skipCache}`);

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      // Directly check localStorage first as it's the fastest option
      try {
        const localData = localStorage.getItem(cacheKey);
        if (localData) {
          const parsedData = JSON.parse(localData);
          // Ensure parsed data is an array
          const dataArray = Array.isArray(parsedData)
            ? (parsedData as ChartDataPoint[])
            : [];

          // Check if data is fresh (less than 5 minutes old)
          const timestamp = localStorage.getItem(`${cacheKey}:timestamp`);
          const dataAge = timestamp
            ? Date.now() - parseInt(timestamp, 10)
            : Infinity;

          if (dataAge < 5 * 60 * 1000) {
            // 5 minutes
            const endTime = performance.now();
            console.log("Using chart data from localStorage cache");
            return {
              data: dataArray,
              source: "cache",
              timing: {
                total: endTime - startTime,
                source: "local-storage",
              },
            };
          }
        }
      } catch (e) {
        // Silently continue if localStorage access fails
        console.log(
          "localStorage access failed for chart, continuing to API cache"
        );
      }

      // Only check API cache if localStorage failed or had stale data
      try {
        const result = await getClientCache(cacheKey);
        if (result.data) {
          // Ensure result.data is an array
          const dataArray = Array.isArray(result.data)
            ? (result.data as ChartDataPoint[])
            : [];

          // Update localStorage for next time
          try {
            localStorage.setItem(cacheKey, JSON.stringify(dataArray));
            localStorage.setItem(
              `${cacheKey}:timestamp`,
              Date.now().toString()
            );
          } catch (e) {
            console.error("Error saving chart data to localStorage:", e);
          }

          const endTime = performance.now();
          console.log("Using chart data from client API cache");
          return {
            data: dataArray,
            source: "cache",
            timing: {
              total: endTime - startTime,
              source: "client-cache",
            },
          };
        }
      } catch (cacheError) {
        console.error("Client API cache error for chart data:", cacheError);
      }
    } catch (cacheError) {
      console.error("Client cache error for chart data:", cacheError);
      // Continue to server fetch if cache fails
    }
  }

  // Fetch from API
  const dbStartTime = performance.now();
  try {
    interface ExpenseWithCategory {
      amount: number;
      currency: "USD" | "UZS";
      amount_uzs: number | null;
      exchange_rate: number | null;
      expense_date: string;
      expense_categories: {
        name: string;
      };
    }

    const { data, error } = await supabase
      .from("expenses")
      .select(
        "amount, currency, amount_uzs, exchange_rate, expense_date, expense_categories!inner(name)"
      )
      .gte("expense_date", dateRange.start.toISOString())
      .lte("expense_date", dateRange.end.toISOString());

    if (error) throw error;

    interface GroupedData {
      [key: string]: ChartDataPoint;
    }

    const groupedData = ((data as ExpenseWithCategory[]) || []).reduce(
      (acc: GroupedData, expense: ExpenseWithCategory) => {
        const date = format(parseISO(expense.expense_date), "yyyy-MM-dd");
        const amount =
          expense.currency === "USD"
            ? expense.amount
            : (expense.amount_uzs || 0) / (expense.exchange_rate || 1);
        const isPayroll = expense.expense_categories.name
          .toLowerCase()
          .includes("payroll");

        if (!acc[date]) {
          acc[date] = {
            date,
            total: 0,
            payroll: 0,
            other: 0,
          };
        }

        acc[date].total += amount;
        if (isPayroll) {
          acc[date].payroll += amount;
        } else {
          acc[date].other += amount;
        }

        return acc;
      },
      {} as GroupedData
    );

    const chartData = (
      Object.values(groupedData || {}) as ChartDataPoint[]
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Cache the chart data
    try {
      // Cache in API
      await setClientCache(cacheKey, chartData, 300);

      // Also cache in localStorage for faster retrieval next time
      try {
        localStorage.setItem(cacheKey, JSON.stringify(chartData));
        localStorage.setItem(`${cacheKey}:timestamp`, Date.now().toString());
      } catch (e) {
        console.error("Error saving chart data to localStorage:", e);
      }
    } catch (cacheError) {
      console.error("Failed to set client cache for chart data:", cacheError);
    }

    const endTime = performance.now();
    console.log(`Chart data loaded from API in ${endTime - dbStartTime}ms`);

    return {
      data: chartData,
      source: "database",
      timing: {
        total: endTime - startTime,
        database: endTime - dbStartTime,
        source: "server",
      },
    };
  } catch (error) {
    console.error("Error fetching chart data:", error);
    const endTime = performance.now();

    return {
      data: [],
      source: "database",
      timing: {
        total: endTime - startTime,
        database: endTime - dbStartTime,
        source: "server",
      },
    };
  }
}

// Clear expense caches (client and server)
export async function clearExpenseCaches(
  userId: string,
  monthKey?: string,
  clearChartData: boolean = true
): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    if (monthKey) {
      // Clear specific month
      const cacheKey = `expenses:${monthKey}:${userId}`;
      await deleteClientCache(cacheKey);

      // Clear localStorage
      try {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}:timestamp`);
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
    } else {
      // Clear all expense caches
      // Use array of promises for parallel execution
      const clearPromises = [];

      // Clear localStorage for all expense keys
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("expenses:") && key.includes(userId)) {
            localStorage.removeItem(key);
            // Also remove timestamp key if it exists
            const timestampKey = `${key}:timestamp`;
            localStorage.removeItem(timestampKey);
          }
        }
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }

      // For client-side API cache, we would need to implement a way to clear all expense keys
      // This might involve a server-side action or maintaining a list of cached keys
      // For now, we'll clear the current month as a minimum
      const currentMonthKey = `expenses:${format(new Date(), "yyyy-MM")}:${userId}`;
      clearPromises.push(deleteClientCache(currentMonthKey));

      await Promise.all(clearPromises);
    }

    // Clear chart data if requested
    if (clearChartData) {
      try {
        // Clear localStorage for all chart keys
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            key.startsWith("expenses:chart:") &&
            key.includes(userId)
          ) {
            localStorage.removeItem(key);
            // Also remove timestamp key if it exists
            const timestampKey = `${key}:timestamp`;
            localStorage.removeItem(timestampKey);
          }
        }

        // Delete client API cache for chart data
        const chartCacheKeyPattern = `expenses:chart:`;
        await deleteClientCache(chartCacheKeyPattern);
      } catch (e) {
        console.error("Error clearing chart data cache:", e);
      }
    }

    return { success: true, message: "Expense caches cleared successfully" };
  } catch (error) {
    console.error("Error clearing expense caches:", error);
    return {
      success: false,
      message: "Failed to clear caches",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
