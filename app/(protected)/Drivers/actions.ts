"use client";

import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";
import {
  getDriversAction,
  getDriverAction,
  createDriverAction,
  updateDriverAction,
  deleteDriverAction,
  clearDriverCachesAction,
} from "./server-actions";
import { Driver, CacheResponse } from "./types";
import { DRIVER_LIST_KEY } from "./redis-client";

// Get drivers with client-side caching
export async function getDrivers(
  skipCache: boolean = false
): Promise<CacheResponse<Driver[]>> {
  const startTime = performance.now();

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      const result = await getClientCache<Driver[]>("drivers:client-list");
      if (result.data) {
        const endTime = performance.now();
        return {
          data: result.data,
          source: "cache",
          timing: { total: endTime - startTime, source: "client-cache" },
        };
      }
    } catch (cacheError) {
      console.error("Client cache error:", cacheError);
      // Continue to server fetch if cache fails
    }
  }

  // Fetch from server (which may use Redis cache)
  const dbStartTime = performance.now();
  const drivers = await getDriversAction();

  // Try to cache the data on client-side
  try {
    await setClientCache("drivers:client-list", drivers);
  } catch (cacheError) {
    console.error("Failed to set client cache:", cacheError);
  }

  const endTime = performance.now();
  return {
    data: drivers as Driver[],
    source: "database",
    timing: {
      total: endTime - startTime,
      database: endTime - dbStartTime,
      source: "server",
    },
  };
}

// Get a single driver with client-side caching
export async function getDriver(
  driverId: number,
  skipCache: boolean = false
): Promise<CacheResponse<Driver | null>> {
  const startTime = performance.now();

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      const result = await getClientCache<Driver>(`driver:client-${driverId}`);
      if (result.data) {
        const endTime = performance.now();
        return {
          data: result.data,
          source: "cache",
          timing: { total: endTime - startTime, source: "client-cache" },
        };
      }
    } catch (cacheError) {
      console.error("Client cache error:", cacheError);
      // Continue to server fetch if cache fails
    }
  }

  // Fetch from server (which may use Redis cache)
  const dbStartTime = performance.now();
  const driver = await getDriverAction(driverId);

  // Try to cache the data on client-side
  if (driver) {
    try {
      await setClientCache(`driver:client-${driverId}`, driver);
    } catch (cacheError) {
      console.error("Failed to set client cache:", cacheError);
    }
  }

  const endTime = performance.now();
  return {
    data: driver as Driver | null,
    source: "database",
    timing: {
      total: endTime - startTime,
      database: endTime - dbStartTime,
      source: "server",
    },
  };
}

// Create a new driver
export async function createDriver(
  driverData: Partial<Driver>
): Promise<Driver | null> {
  const driver = await createDriverAction(driverData);

  // Invalidate client caches
  try {
    await deleteClientCache("drivers:client-list");
  } catch (error) {
    console.error("Error invalidating client cache:", error);
  }

  return driver as Driver | null;
}

// Update a driver
export async function updateDriver(
  driverId: number,
  driverData: Partial<Driver>
): Promise<Driver | null> {
  const driver = await updateDriverAction(driverId, driverData);

  // Invalidate client caches
  try {
    await deleteClientCache("drivers:client-list");
    await deleteClientCache(`driver:client-${driverId}`);
  } catch (error) {
    console.error("Error invalidating client cache:", error);
  }

  return driver as Driver | null;
}

// Delete a driver
export async function deleteDriver(driverId: number): Promise<boolean> {
  const result = await deleteDriverAction(driverId);

  // Invalidate client caches
  try {
    await deleteClientCache("drivers:client-list");
    await deleteClientCache(`driver:client-${driverId}`);
  } catch (error) {
    console.error("Error invalidating client cache:", error);
  }

  return result;
}

// Server-side cache clearing wrapper
export async function clearDriverCaches(): Promise<boolean> {
  try {
    const result = await clearDriverCachesAction();
    return result;
  } catch (error) {
    console.error("Error clearing Redis caches:", error);
    return false;
  }
}
