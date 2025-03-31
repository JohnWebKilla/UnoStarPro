"use client";

import { MonthlyPayrollSummary } from "../types";
import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";
import { format } from "date-fns";

// Define response type for cached data
export interface PayrollApiResponse {
  data: MonthlyPayrollSummary[];
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source?: "client-cache" | "server" | "local-storage";
  };
}

// Get monthly payroll summaries with multi-layer caching
export async function getMonthlyPayrollSummaries(
  selectedMonth: Date,
  skipCache: boolean = false
): Promise<PayrollApiResponse> {
  const startTime = performance.now();
  const monthKey = format(selectedMonth, "yyyy-MM");
  const cacheKey = `payroll:${monthKey}`;

  console.log(`Fetching payroll data for ${monthKey}, skipCache: ${skipCache}`);

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      // Directly check localStorage first as it's the fastest option
      // This is a performance optimization to avoid the overhead of parallel promises
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
            console.log("Using payroll data from localStorage cache");
            // No delay needed - immediate return for better performance
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
        const result = await getClientCache<MonthlyPayrollSummary[]>(cacheKey);
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
          console.log("Using payroll data from client API cache");
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
    const response = await fetch(
      `/api/payroll/monthly-summary?month=${monthKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Ensure result.data is an array
    const dataArray = Array.isArray(result.data) ? result.data : [];
    if (!Array.isArray(result.data)) {
      console.error("Invalid data format received:", result);
    }

    // Cache the data
    // Try to cache the data on client-side
    try {
      // Cache in API
      await setClientCache(cacheKey, dataArray);

      // Also cache in localStorage for faster retrieval next time
      try {
        localStorage.setItem(cacheKey, JSON.stringify(dataArray));
        localStorage.setItem(`${cacheKey}:timestamp`, Date.now().toString());
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    } catch (cacheError) {
      console.error("Failed to set client cache:", cacheError);
    }

    const endTime = performance.now();
    console.log(`Payroll data loaded from API in ${endTime - dbStartTime}ms`);

    return {
      data: dataArray,
      source: "database",
      timing: {
        total: endTime - startTime,
        database: endTime - dbStartTime,
        source: "server",
      },
    };
  } catch (error) {
    console.error("Error fetching monthly payroll summary:", error);
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

// Clear payroll caches (client and server)
export async function clearPayrollCaches(monthKey?: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    if (monthKey) {
      // Clear specific month
      const cacheKey = `payroll:${monthKey}`;
      await deleteClientCache(cacheKey);

      // Clear localStorage
      try {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}:timestamp`);
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
    } else {
      // Clear all payroll caches
      // Use array of promises for parallel execution
      const clearPromises = [];

      // Clear localStorage for all payroll keys
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("payroll:")) {
            localStorage.removeItem(key);
            // Also remove timestamp key if it exists
            const timestampKey = `${key}:timestamp`;
            localStorage.removeItem(timestampKey);
          }
        }
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }

      // For client-side API cache, we would need to implement a way to clear all payroll keys
      // This might involve a server-side action or maintaining a list of cached keys
      // For now, we'll clear the current month as a minimum
      const currentMonthKey = `payroll:${format(new Date(), "yyyy-MM")}`;
      clearPromises.push(deleteClientCache(currentMonthKey));

      await Promise.all(clearPromises);
    }

    return { success: true, message: "Payroll cache cleared successfully" };
  } catch (error) {
    console.error("Error clearing payroll cache:", error);
    return {
      success: false,
      message: "Failed to clear cache",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
