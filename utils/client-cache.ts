/**
 * Client-side cache utility functions for interacting with the Redis cache API
 */

/**
 * Get data from cache
 * @param key Cache key
 * @returns The cached data or null if not found
 */
export async function getClientCache<T>(
  key: string
): Promise<{ data: T | null; source: "cache" | "database" }> {
  try {
    const response = await fetch(`/api/cache?key=${encodeURIComponent(key)}`);
    if (!response.ok) {
      throw new Error(`Failed to get cache: ${response.statusText}`);
    }
    const result = await response.json();
    return {
      data: result.data,
      source: result.source,
    };
  } catch (error) {
    console.error(`Error getting cache for key ${key}:`, error);
    return { data: null, source: "database" };
  }
}

/**
 * Set data in cache
 * @param key Cache key
 * @param value Data to cache
 * @param expiryInSeconds Cache expiration time in seconds (default: 300)
 */
export async function setClientCache<T>(
  key: string,
  value: T,
  expiryInSeconds: number = 300
): Promise<boolean> {
  try {
    const response = await fetch("/api/cache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, value, expiryInSeconds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to set cache: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete data from cache
 * @param key Cache key
 */
export async function deleteClientCache(key: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/cache?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete cache: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`Error deleting cache for key ${key}:`, error);
    return false;
  }
}
