import { createClient } from "@/utils/supabase/server";
import { getCache, setCache, deleteCache } from "./redis";

/**
 * Fetches data from Supabase with Redis caching
 *
 * @param tableName - Supabase table name
 * @param queryBuilder - Function to build and execute the Supabase query
 * @param cacheKey - Key to use for caching (if not provided, caching is disabled)
 * @param expiryInSeconds - Cache expiration time in seconds
 * @returns The query result
 */
export async function fetchWithCache<T>(
  tableName: string,
  queryBuilder: (supabase: any) => Promise<{ data: T | null; error: any }>,
  cacheKey?: string,
  expiryInSeconds: number = 300
): Promise<{ data: T | null; error: any; source?: "cache" | "database" }> {
  // If no cache key provided, skip caching
  if (!cacheKey) {
    const supabase = await createClient();
    return await queryBuilder(supabase);
  }

  try {
    // Try to get data from cache first
    const cachedData = await getCache<T>(cacheKey);

    if (cachedData) {
      return { data: cachedData, error: null, source: "cache" };
    }

    // If not in cache, fetch from Supabase
    const supabase = await createClient();
    const { data, error } = await queryBuilder(supabase);

    // If successful, store in cache
    if (data && !error) {
      await setCache(cacheKey, data, expiryInSeconds);
    }

    return { data, error, source: "database" };
  } catch (error) {
    console.error(`Error in fetchWithCache for key ${cacheKey}:`, error);
    // If Redis fails, fall back to direct database query
    const supabase = await createClient();
    return await queryBuilder(supabase);
  }
}

/**
 * Invalidates cache for a specific key or pattern
 *
 * @param cacheKey - Exact cache key to invalidate
 */
export async function invalidateCache(cacheKey: string): Promise<void> {
  try {
    await deleteCache(cacheKey);
  } catch (error) {
    console.error(`Error invalidating cache for key ${cacheKey}:`, error);
  }
}

/**
 * Builds a cache key from parts
 *
 * @param tableName - Supabase table name
 * @param operation - Operation type (e.g., 'get', 'list')
 * @param identifiers - Additional identifiers (e.g., record IDs, query params)
 * @returns Formatted cache key
 */
export function buildSupabaseCacheKey(
  tableName: string,
  operation: string,
  ...identifiers: (string | number | boolean | null | undefined)[]
): string {
  const validIdentifiers = identifiers.filter(
    (id) => id !== null && id !== undefined
  );
  return `supabase:${tableName}:${operation}:${validIdentifiers.join(":")}`;
}
