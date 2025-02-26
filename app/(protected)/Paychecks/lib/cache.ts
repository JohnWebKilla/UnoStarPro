import { getCache, setCache, deleteCache } from "@/lib/redis";
import { format } from "date-fns";

// Cache expiration time in seconds (5 minutes)
const CACHE_EXPIRATION = 300;

/**
 * Builds a cache key for payroll data
 *
 * @param month - The month for which data is being fetched
 * @returns Formatted cache key
 */
export function buildPayrollCacheKey(month: Date): string {
  const formattedMonth = format(month, "yyyy-MM");
  return `payroll:monthly-summary:${formattedMonth}`;
}

/**
 * Fetches payroll data with Redis caching
 *
 * @param month - The month for which to fetch data
 * @param fetchFn - Function to fetch data from the database
 * @param skipCache - Whether to skip the cache and fetch fresh data
 * @returns The payroll data and source information
 */
export async function fetchPayrollWithCache<T>(
  month: Date,
  fetchFn: () => Promise<T>,
  skipCache: boolean = false
): Promise<{ data: T | null; source: "cache" | "database" }> {
  const cacheKey = buildPayrollCacheKey(month);

  // If skipCache is true, bypass cache lookup
  if (!skipCache) {
    try {
      // Try to get data from cache
      const cachedData = await getCache<T>(cacheKey);

      if (cachedData) {
        console.log(`Cache hit for ${cacheKey}`);
        return { data: cachedData, source: "cache" };
      }
      console.log(`Cache miss for ${cacheKey}`);
    } catch (error) {
      console.error(`Error retrieving from cache (${cacheKey}):`, error);
      // Continue to fetch from database on cache error
    }
  } else {
    console.log(`Skipping cache for ${cacheKey}`);
  }

  // Fetch fresh data from database
  try {
    console.log(`Fetching from database for ${cacheKey}`);
    const data = await fetchFn();

    // Store in cache if we have data
    if (data) {
      try {
        await setCache(cacheKey, data, CACHE_EXPIRATION);
        console.log(`Cached data for ${cacheKey}`);
      } catch (cacheError) {
        console.error(`Error caching data (${cacheKey}):`, cacheError);
        // Continue even if caching fails
      }
    }

    return { data, source: "database" };
  } catch (error) {
    console.error(`Error fetching data from database:`, error);
    return { data: null, source: "database" };
  }
}

/**
 * Invalidates the cache for a specific month
 *
 * @param month - The month for which to invalidate the cache
 */
export async function invalidatePayrollCache(month: Date): Promise<void> {
  try {
    const cacheKey = buildPayrollCacheKey(month);
    await deleteCache(cacheKey);
    console.log(`Cache invalidated for ${cacheKey}`);
  } catch (error) {
    console.error("Error invalidating payroll cache:", error);
  }
}
