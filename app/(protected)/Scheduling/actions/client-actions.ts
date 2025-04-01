"use client";

import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";
import { format } from "date-fns";
import { getInitialSchedulingData } from "../actions";
import type {
  SchedulingStats,
  Employee,
  Absence,
  Schedule,
  ShiftType,
} from "../types";

// Define response type for cached data
export interface SchedulingApiResponse {
  data: {
    stats: SchedulingStats;
    employees: Employee[];
    absences: Absence[];
    schedules: {
      id: number;
      user_id: string;
      working_shift: string;
      off_days: string[];
      created_at: string;
      updated_at: string;
    }[];
  };
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source?: "client-cache" | "server" | "local-storage";
  };
}

// Get scheduling data with multi-layer caching
export async function getSchedulingData(
  startDate: Date,
  endDate: Date,
  skipCache: boolean = false
): Promise<SchedulingApiResponse> {
  const startTime = performance.now();
  const startFormatted = format(startDate, "yyyy-MM-dd");
  const endFormatted = format(endDate, "yyyy-MM-dd");
  const cacheKey = `scheduling:${startFormatted}:${endFormatted}`;

  console.log(
    `Fetching scheduling data for ${startFormatted} to ${endFormatted}, skipCache: ${skipCache}`
  );

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      // Directly check localStorage first as it's the fastest option
      try {
        const localData = localStorage.getItem(cacheKey);
        if (localData) {
          const parsedData = JSON.parse(localData);
          const timestamp = localStorage.getItem(`${cacheKey}:timestamp`);
          const dataAge = timestamp
            ? Date.now() - parseInt(timestamp, 10)
            : Infinity;

          if (dataAge < 5 * 60 * 1000) {
            // 5 minutes
            const endTime = performance.now();
            console.log("Using scheduling data from localStorage cache");
            return {
              data: parsedData,
              source: "cache",
              timing: {
                total: endTime - startTime,
                source: "local-storage",
              },
            };
          } else {
            // If data is stale, remove it
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(`${cacheKey}:timestamp`);
          }
        }
      } catch (e) {
        console.log("localStorage access failed, continuing to API cache");
      }

      // Only check API cache if localStorage failed or had stale data
      const cacheResult = await getClientCache(cacheKey);
      if (cacheResult.data) {
        const cachedData = cacheResult.data as {
          stats: SchedulingStats;
          employees: Employee[];
          absences: Absence[];
          schedules: {
            id: number;
            user_id: string;
            working_shift: string;
            off_days: string[];
            created_at: string;
            updated_at: string;
          }[];
        };

        // Update localStorage for next time
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cachedData));
          localStorage.setItem(`${cacheKey}:timestamp`, Date.now().toString());
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }

        const endTime = performance.now();
        console.log("Using scheduling data from client API cache");
        return {
          data: cachedData,
          source: "cache",
          timing: {
            total: endTime - startTime,
            source: "client-cache",
          },
        };
      }
    } catch (cacheError) {
      console.error("Cache error:", cacheError);
      // Continue to server fetch if cache fails
    }
  }

  // Fetch from API if cache miss or skip cache
  const dbStartTime = performance.now();
  try {
    const result = await getInitialSchedulingData(startFormatted, endFormatted);
    if (result.error) throw new Error(result.error);

    const data = {
      stats: {
        totalEmployees: result.stats?.totalEmployees ?? 0,
        activeShifts: result.stats?.activeShifts ?? 0,
        todayAbsences: result.stats?.todayAbsences ?? 0,
        error: null,
      },
      employees: result.employees ?? [],
      absences: result.absences ?? [],
      schedules: result.schedules ?? [],
    };

    // Cache the fresh data
    try {
      await Promise.all([
        setClientCache(cacheKey, data, 300),
        new Promise<void>((resolve) => {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(
              `${cacheKey}:timestamp`,
              Date.now().toString()
            );
          } catch (e) {
            console.error("Error saving to localStorage:", e);
          }
          resolve();
        }),
      ]);
    } catch (cacheError) {
      console.error("Failed to set cache:", cacheError);
    }

    const endTime = performance.now();
    return {
      data,
      source: "database",
      timing: {
        total: endTime - startTime,
        database: endTime - dbStartTime,
        source: "server",
      },
    };
  } catch (error) {
    console.error("Error fetching scheduling data:", error);
    throw error;
  }
}

// Clear scheduling caches
export async function clearSchedulingCaches(dateRange?: {
  start: Date;
  end: Date;
}): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    if (dateRange) {
      // Clear specific date range
      const startFormatted = format(dateRange.start, "yyyy-MM-dd");
      const endFormatted = format(dateRange.end, "yyyy-MM-dd");
      const cacheKey = `scheduling:${startFormatted}:${endFormatted}`;

      // Clear client API cache
      await deleteClientCache(cacheKey);

      // Clear localStorage
      try {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}:timestamp`);
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
    } else {
      // Clear all scheduling caches
      // Clear localStorage for all scheduling keys
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("scheduling:")) {
            localStorage.removeItem(key);
            // Also remove timestamp key if it exists
            const timestampKey = `${key}:timestamp`;
            localStorage.removeItem(timestampKey);
          }
        }
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }

      // For client-side API cache, clear the scheduling key pattern
      await deleteClientCache("scheduling:");
    }

    return { success: true, message: "Scheduling caches cleared successfully" };
  } catch (error) {
    console.error("Error clearing scheduling caches:", error);
    return {
      success: false,
      message: "Failed to clear caches",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
