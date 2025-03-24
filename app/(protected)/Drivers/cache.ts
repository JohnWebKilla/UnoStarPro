"use server";

import { setCache, getCache } from "@/lib/redis";
import {
  DRIVER_LIST_KEY,
  DRIVER_DETAIL_KEY,
  DRIVER_DOCUMENTS_KEY,
  CACHE_EXPIRATION,
} from "./constants";

// Clear driver list cache
export async function clearDriverListCache() {
  try {
    await setCache(DRIVER_LIST_KEY, null, 0);
    console.log("Cleared driver list cache");
    return true;
  } catch (error) {
    console.error("Failed to clear driver list cache:", error);
    return false;
  }
}

// Clear specific driver cache
export async function clearDriverCache(driverId: number) {
  try {
    const detailKey = DRIVER_DETAIL_KEY(driverId);
    const documentsKey = DRIVER_DOCUMENTS_KEY(driverId);

    // Clear both keys
    await setCache(detailKey, null, 0);
    await setCache(documentsKey, null, 0);

    console.log(`Cleared cache for driver ${driverId}`);
    return true;
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

// Set driver detail cache
export async function setDriverDetailCache(driverId: number, data: any) {
  return await setCache(DRIVER_DETAIL_KEY(driverId), data, CACHE_EXPIRATION);
}

// Set driver documents cache
export async function setDriverDocumentsCache(driverId: number, data: any) {
  return await setCache(DRIVER_DOCUMENTS_KEY(driverId), data, CACHE_EXPIRATION);
}
