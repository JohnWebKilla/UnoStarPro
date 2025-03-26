import { getCache, setCache } from "./redis";
import { Role } from "@/types/role";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

const CACHE_TTL = 300; // 5 minutes

interface CommonData {
  users?: any[];
  companies?: any[];
  drivers?: any[];
  dashboard?: any;
  expenses?: any;
  scheduling?: any;
  payroll?: any;
}

type CacheOperation = () => Promise<void>;

/**
 * Generic function to cache database query results
 *
 * @param cacheKey - Unique key for the cache entry
 * @param fetchFn - Function that fetches data from the database
 * @param expirationInSeconds - Cache expiration time in seconds (default: 5 minutes)
 * @returns The cached data or freshly fetched data
 */
export async function cachedQuery<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  expirationInSeconds: number = 300
): Promise<{ data: T; source: "cache" | "database" }> {
  try {
    // Try to get data from cache first
    const cachedData = await getCache<T>(cacheKey);

    if (cachedData) {
      return { data: cachedData, source: "cache" };
    }

    // If not in cache, fetch from database
    const data = await fetchFn();

    // Store in cache for future requests
    await setCache(cacheKey, data, expirationInSeconds);

    return { data, source: "database" };
  } catch (error) {
    console.error(`Error in cachedQuery for key ${cacheKey}:`, error);
    throw error;
  }
}

/**
 * Builds a cache key from parts
 *
 * @param prefix - Prefix for the cache key (e.g., 'user', 'company')
 * @param parts - Additional parts to include in the key
 * @returns Formatted cache key
 */
export function buildCacheKey(
  prefix: string,
  ...parts: (string | number | boolean | null | undefined)[]
): string {
  const validParts = parts.filter(
    (part) => part !== null && part !== undefined
  );
  return `${prefix}:${validParts.join(":")}`;
}

export async function cacheCommonData(
  userId: string,
  role: Role
): Promise<void> {
  const cookieStore = cookies();
  const month = new Date().toISOString().slice(0, 7);
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().slice(0, 7);

  // Define all cache operations based on role
  const cacheOperations: CacheOperation[] = [];

  // Admin and superadmin specific caching
  if (role === "admin" || role === "superadmin") {
    // Cache users
    cacheOperations.push(async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase.from("users").select("*").limit(100);
        if (data) {
          // Cache both formats
          await setCache(`users:list:${userId}`, data, CACHE_TTL);
          await setCache(`api:/api/users`, data, CACHE_TTL);
        }
      } catch (error) {
        console.error("Error caching users:", error);
      }
    });

    // Cache companies
    cacheOperations.push(async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from("companies")
          .select("*")
          .limit(100);
        if (data) {
          // Cache both formats
          await setCache("companies:list", data, CACHE_TTL);
          await setCache(`api:/api/companies`, data, CACHE_TTL);
        }
      } catch (error) {
        console.error("Error caching companies:", error);
      }
    });

    // Cache drivers
    cacheOperations.push(async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase.from("drivers").select("*").limit(100);
        if (data) {
          // Cache both formats
          await setCache("drivers:client-list", data, CACHE_TTL);
          await setCache(`api:/api/drivers`, data, CACHE_TTL);
        }
      } catch (error) {
        console.error("Error caching drivers:", error);
      }
    });
  }

  // Common caching for all roles
  // Cache dashboard data
  cacheOperations.push(async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase.rpc("get_dashboard_data", {
        user_id: userId,
      });
      if (data) {
        // Cache both formats
        await setCache(`dashboard:${userId}`, data, CACHE_TTL);
        await setCache(`api:/api/dashboard`, data, CACHE_TTL);
      }
    } catch (error) {
      console.error("Error caching dashboard:", error);
    }
  });

  // Cache expenses for current and next month
  cacheOperations.push(async () => {
    try {
      const supabase = await createClient();

      // Current month expenses
      const { data: currentData } = await supabase.rpc("get_expenses", {
        month_param: month,
      });
      if (currentData) {
        // Cache both formats
        await setCache(`expenses:${month}:${userId}`, currentData, CACHE_TTL);
        await setCache(
          `api:/api/expenses?month=${month}`,
          currentData,
          CACHE_TTL
        );
        await setCache(
          `expenses:chart:${month}:${userId}`,
          currentData,
          CACHE_TTL
        );
        await setCache(
          `api:/api/expenses/chart?month=${month}`,
          currentData,
          CACHE_TTL
        );
      }

      // Next month expenses
      const { data: nextData } = await supabase.rpc("get_expenses", {
        month_param: nextMonthStr,
      });
      if (nextData) {
        // Cache both formats
        await setCache(
          `expenses:${nextMonthStr}:${userId}`,
          nextData,
          CACHE_TTL
        );
        await setCache(
          `api:/api/expenses?month=${nextMonthStr}`,
          nextData,
          CACHE_TTL
        );
        await setCache(
          `expenses:chart:${nextMonthStr}:${userId}`,
          nextData,
          CACHE_TTL
        );
        await setCache(
          `api:/api/expenses/chart?month=${nextMonthStr}`,
          nextData,
          CACHE_TTL
        );
      }
    } catch (error) {
      console.error("Error caching expenses:", error);
    }
  });

  // Cache scheduling
  cacheOperations.push(async () => {
    try {
      const supabase = await createClient();
      const [{ data: employees }, { data: schedules }] = await Promise.all([
        supabase.from("users").select("*"),
        supabase.from("schedules").select("*"),
      ]);
      if (employees && schedules) {
        const schedulingData = {
          employees,
          schedules,
        };
        // Cache both formats
        await setCache("scheduling:data", schedulingData, CACHE_TTL);
        await setCache(`api:/api/scheduling`, schedulingData, CACHE_TTL);
      }
    } catch (error) {
      console.error("Error caching scheduling:", error);
    }
  });

  // Cache payroll for current and next month
  cacheOperations.push(async () => {
    try {
      const supabase = await createClient();

      // Current month payroll
      const { data: currentData } = await supabase.rpc("get_monthly_payroll", {
        month_param: month,
      });
      if (currentData) {
        // Cache both formats
        await setCache(
          `payroll:summary:${month}:${userId}`,
          currentData,
          CACHE_TTL
        );
        await setCache(
          `api:/api/payroll/monthly-summary?month=${month}`,
          currentData,
          CACHE_TTL
        );
      }

      // Next month payroll
      const { data: nextData } = await supabase.rpc("get_monthly_payroll", {
        month_param: nextMonthStr,
      });
      if (nextData) {
        // Cache both formats
        await setCache(
          `payroll:summary:${nextMonthStr}:${userId}`,
          nextData,
          CACHE_TTL
        );
        await setCache(
          `api:/api/payroll/monthly-summary?month=${nextMonthStr}`,
          nextData,
          CACHE_TTL
        );
      }
    } catch (error) {
      console.error("Error caching payroll:", error);
    }
  });

  // Execute all cache operations in parallel
  await Promise.all(cacheOperations.map((op) => op()));
  console.log(`Cache warming completed for user ${userId} with role ${role}`);
}
