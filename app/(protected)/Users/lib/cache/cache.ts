"use server";

import { getCache, setCache, deleteCache } from "@/lib/redis";
import { USER_LIST_KEY, USER_DETAIL_KEY, CACHE_EXPIRATION } from "./constants";

// Get cached user list
export async function getCachedUserList() {
  return await getCache(USER_LIST_KEY);
}

// Set cached user list
export async function setCachedUserList(data: any) {
  return await setCache(USER_LIST_KEY, data, CACHE_EXPIRATION);
}

// Get cached user details
export async function getCachedUserDetail(userId: string) {
  return await getCache(USER_DETAIL_KEY(userId));
}

// Set cached user details
export async function setCachedUserDetail(userId: string, data: any) {
  return await setCache(USER_DETAIL_KEY(userId), data, CACHE_EXPIRATION);
}

// Clear user list cache
export async function clearUserListCache() {
  return await deleteCache(USER_LIST_KEY);
}

// Clear user detail cache
export async function clearUserDetailCache(userId: string) {
  return await deleteCache(USER_DETAIL_KEY(userId));
}

// Clear all user caches
export async function clearAllUserCaches() {
  // Clear the main list cache
  await clearUserListCache();

  // Note: This doesn't clear individual user detail caches
  // Those would need to be cleared based on known IDs

  return true;
}
