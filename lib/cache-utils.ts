import { getCache, setCache } from "./redis";

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
