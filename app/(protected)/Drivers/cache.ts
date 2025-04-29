"use server";

import { setCache, getCache } from "@/lib/redis";
import {
  DRIVER_LIST_KEY,
  DRIVER_DETAIL_KEY,
  DRIVER_DOCUMENTS_KEY,
  CACHE_EXPIRATION,
} from "./constants";

// Time in milliseconds to consider cache fresh
const CACHE_FRESHNESS = 60 * 1000; // 1 minute
const lastCacheClear = {
  driverList: 0,
  driverDetails: {} as Record<number, number>,
};

// Clear driver list cache with throttling
export async function clearDriverListCache(force = false) {
  try {
    const now = Date.now();
    // Only clear if forced or if it's been more than CACHE_FRESHNESS since last clear
    if (force || now - lastCacheClear.driverList > CACHE_FRESHNESS) {
      await setCache(DRIVER_LIST_KEY, null, 0);
      lastCacheClear.driverList = now;
      console.log("Cleared driver list cache from Redis");
      return true;
    } else {
      console.log("Skipping driver list cache clear - recently cleared");
      return false;
    }
  } catch (error) {
    console.error("Failed to clear driver list cache:", error);
    return false;
  }
}

// Clear specific driver cache with throttling
export async function clearDriverCache(driverId: number, force = false) {
  try {
    const now = Date.now();
    // Only clear if forced or if it's been more than CACHE_FRESHNESS since last clear
    if (
      force ||
      !lastCacheClear.driverDetails[driverId] ||
      now - lastCacheClear.driverDetails[driverId] > CACHE_FRESHNESS
    ) {
      const detailKey = DRIVER_DETAIL_KEY(driverId);
      const documentsKey = DRIVER_DOCUMENTS_KEY(driverId);

      // Clear Redis cache
      await setCache(detailKey, null, 0);
      await setCache(documentsKey, null, 0);

      lastCacheClear.driverDetails[driverId] = now;
      console.log(`Cleared cache for driver ${driverId} from Redis`);
      return true;
    } else {
      console.log(`Skipping driver ${driverId} cache clear - recently cleared`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to clear cache for driver ${driverId}:`, error);
    return false;
  }
}

// Get cached driver list with their documents
export async function getCachedDriverList() {
  return await getCache(DRIVER_LIST_KEY);
}

// Get cached driver detail
export async function getCachedDriver(driverId: number) {
  return await getCache(DRIVER_DETAIL_KEY(driverId));
}

// Get cached driver documents
export async function getCachedDriverDocuments(driverId: number) {
  return await getCache(DRIVER_DOCUMENTS_KEY(driverId));
}

// Set driver list cache
export async function setDriverListCache(data: any) {
  return await setCache(DRIVER_LIST_KEY, data, CACHE_EXPIRATION);
}

// Set driver detail cache with timestamp
export async function setDriverDetailCache(driverId: number, data: any) {
  // Add a timestamp to the data for freshness check
  const timestampedData = {
    ...data,
    _cacheTimestamp: Date.now(),
  };
  return await setCache(
    DRIVER_DETAIL_KEY(driverId),
    timestampedData,
    CACHE_EXPIRATION
  );
}

// Set driver documents cache
export async function setDriverDocumentsCache(driverId: number, data: any) {
  return await setCache(DRIVER_DOCUMENTS_KEY(driverId), data, CACHE_EXPIRATION);
}

// Check if cached driver is fresh enough
export async function isCachedDriverFresh(
  driverId: number,
  maxAge = CACHE_FRESHNESS
) {
  const cached = await getCachedDriver(driverId);
  if (!cached) return false;

  // Use type assertion to access the timestamp
  const timestamp = (cached as any)._cacheTimestamp;
  if (!timestamp) return false;

  return Date.now() - timestamp < maxAge;
}
