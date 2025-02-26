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
  try {
    // Build cache key
    const cacheKey = buildPayrollCacheKey(month);

    // Skip cache if requested
    if (skipCache) {
      const data = await fetchFn();

      // Update cache with fresh data
      await setCache(cacheKey, data, CACHE_EXPIRATION);

      return { data, source: "database" };
    }

    // Try to get data from cache first
    const cachedData = await getCache<T>(cacheKey);

    if (cachedData) {
      console.log("Payroll data retrieved from Redis cache");
      return { data: cachedData, source: "cache" };
    }

    // If not in cache, fetch from database
    console.log("Cache miss, fetching payroll data from database");
    const data = await fetchFn();

    // Store in cache for future requests
    await setCache(cacheKey, data, CACHE_EXPIRATION);

    return { data, source: "database" };
  } catch (error) {
    console.error("Error in fetchPayrollWithCache:", error);
    // If Redis fails, fall back to direct database query
    const data = await fetchFn();
    return { data, source: "database" };
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
