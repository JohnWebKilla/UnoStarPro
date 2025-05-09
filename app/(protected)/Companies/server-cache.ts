"use server";

import { setCache, getCache } from "@/lib/redis";
import {
  COMPANY_LIST_KEY,
  COMPANY_DETAIL_KEY,
  CACHE_EXPIRATION,
} from "./cache";

// Time in milliseconds to consider cache fresh
const CACHE_FRESHNESS = 60 * 1000; // 1 minute
const lastCacheClear = {
  companyList: 0,
  companyDetails: {} as Record<number, number>,
};

// Clear company list cache with throttling
export async function clearCompanyListCache(force = false) {
  try {
    const now = Date.now();
    // Only clear if forced or if it's been more than CACHE_FRESHNESS since last clear
    if (force || now - lastCacheClear.companyList > CACHE_FRESHNESS) {
      await setCache(COMPANY_LIST_KEY, null, 0);
      lastCacheClear.companyList = now;
      console.log("Cleared company list cache from Redis");
      return true;
    } else {
      console.log("Skipping company list cache clear - recently cleared");
      return false;
    }
  } catch (error) {
    console.error("Failed to clear company list cache:", error);
    return false;
  }
}

// Clear specific company cache with throttling
export async function clearCompanyCache(companyId: number, force = false) {
  try {
    const now = Date.now();
    // Only clear if forced or if it's been more than CACHE_FRESHNESS since last clear
    if (
      force ||
      !lastCacheClear.companyDetails[companyId] ||
      now - lastCacheClear.companyDetails[companyId] > CACHE_FRESHNESS
    ) {
      const detailKey = COMPANY_DETAIL_KEY(companyId);

      // Clear Redis cache
      await setCache(detailKey, null, 0);

      lastCacheClear.companyDetails[companyId] = now;
      console.log(`Cleared cache for company ${companyId} from Redis`);

      return true;
    } else {
      console.log(
        `Skipping company ${companyId} cache clear - recently cleared`
      );
      return false;
    }
  } catch (error) {
    console.error(`Failed to clear cache for company ${companyId}:`, error);
    return false;
  }
}

// Get cached company list
export async function getCachedCompanyList() {
  return await getCache(COMPANY_LIST_KEY);
}

// Get cached company detail
export async function getCachedCompany(companyId: number) {
  return await getCache(COMPANY_DETAIL_KEY(companyId));
}

// Set company list cache
export async function setCompanyListCache(data: any) {
  return await setCache(COMPANY_LIST_KEY, data, CACHE_EXPIRATION);
}

// Set company detail cache with timestamp
export async function setCompanyDetailCache(companyId: number, data: any) {
  // Add a timestamp to the data for freshness check
  const timestampedData = {
    ...data,
    _cacheTimestamp: Date.now(),
  };
  return await setCache(
    COMPANY_DETAIL_KEY(companyId),
    timestampedData,
    CACHE_EXPIRATION
  );
}
