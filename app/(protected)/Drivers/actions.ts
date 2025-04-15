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
  updateDriverStatusAction,
  updateDriverStatusBatchAction,
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
      // Check localStorage first for the fastest possible retrieval
      const localData = localStorage.getItem("drivers:client-list");
      if (localData) {
        try {
          const parsedData = JSON.parse(localData);
          // Check if data is fresh (less than 5 minutes old)
          const timestamp = localStorage.getItem(
            "drivers:client-list:timestamp"
          );
          const dataAge = timestamp
            ? Date.now() - parseInt(timestamp, 10)
            : Infinity;

          if (dataAge < 5 * 60 * 1000) {
            // 5 minutes
            const endTime = performance.now();
            return {
              data: parsedData,
              source: "cache",
              timing: { total: endTime - startTime, source: "local-storage" },
            };
          }
        } catch (e) {
          // Invalid JSON, continue to fetch from API
          console.log("Invalid localStorage data, fetching from API");
        }
      }

      // If not in localStorage or too old, try API cache
      const result = await getClientCache<Driver[]>("drivers:client-list");
      if (result.data) {
        // Update localStorage for next time
        try {
          localStorage.setItem(
            "drivers:client-list",
            JSON.stringify(result.data)
          );
          localStorage.setItem(
            "drivers:client-list:timestamp",
            Date.now().toString()
          );
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }

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
    // Cache in API
    await setClientCache("drivers:client-list", drivers);

    // Also cache in localStorage for faster retrieval next time
    try {
      localStorage.setItem("drivers:client-list", JSON.stringify(drivers));
      localStorage.setItem(
        "drivers:client-list:timestamp",
        Date.now().toString()
      );
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
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
      // Check localStorage first for the fastest possible retrieval
      const localKey = `driver:client-${driverId}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        try {
          const parsedData = JSON.parse(localData);
          // Check if data is fresh (less than 5 minutes old)
          const timestamp = localStorage.getItem(`${localKey}:timestamp`);
          const dataAge = timestamp
            ? Date.now() - parseInt(timestamp, 10)
            : Infinity;

          if (dataAge < 5 * 60 * 1000) {
            // 5 minutes
            const endTime = performance.now();
            return {
              data: parsedData,
              source: "cache",
              timing: { total: endTime - startTime, source: "local-storage" },
            };
          }
        } catch (e) {
          // Invalid JSON, continue to fetch from API
          console.log("Invalid localStorage data, fetching from API");
        }
      }

      // If not in localStorage or too old, try API cache
      const result = await getClientCache<Driver>(`driver:client-${driverId}`);
      if (result.data) {
        // Update localStorage for next time
        try {
          localStorage.setItem(localKey, JSON.stringify(result.data));
          localStorage.setItem(`${localKey}:timestamp`, Date.now().toString());
        } catch (e) {
          console.error("Error saving to localStorage:", e);
        }

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
      const localKey = `driver:client-${driverId}`;

      // Cache in API
      await setClientCache(localKey, driver);

      // Also cache in localStorage for faster retrieval next time
      try {
        localStorage.setItem(localKey, JSON.stringify(driver));
        localStorage.setItem(`${localKey}:timestamp`, Date.now().toString());
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
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

export {
  getDriversAction,
  getDriverAction,
  createDriverAction,
  updateDriverAction,
  deleteDriverAction,
  clearDriverCachesAction,
  updateDriverStatusAction,
  updateDriverStatusBatchAction,
} from "./server-actions";
