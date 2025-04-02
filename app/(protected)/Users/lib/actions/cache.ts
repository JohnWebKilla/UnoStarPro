import { USER_LIST_KEY, USER_DETAIL_KEY } from "./constants";
import { getCache, deleteCache } from "@/lib/redis";

/**
 * Clear the user list cache
 */
export async function clearUserListCache(): Promise<void> {
  await deleteCache(USER_LIST_KEY);
}

/**
 * Clear a specific user's detail cache
 */
export async function clearUserDetailCache(userId: string): Promise<void> {
  const cacheKey = USER_DETAIL_KEY(userId);
  await deleteCache(cacheKey);
}

/**
 * Clear all user-related caches
 */
export async function clearAllUserCaches(): Promise<void> {
  await clearUserListCache();
  // Note: This won't clear individual user caches as we don't have a list of all user IDs
  // Individual user caches will expire naturally based on their TTL
}
