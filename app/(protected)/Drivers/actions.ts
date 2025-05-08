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
  syncDriverWithStripeAction,
  revalidateDriverPathsAction,
} from "./server-actions";
import { Driver, CacheResponse } from "./types";
import { DRIVER_LIST_KEY } from "./redis-client";
import { getRealTimeClient } from "@/utils/supabase/client";

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
  try {
    // Check for recent duplicates in localStorage
    if (driverData.name && driverData.phone_number && driverData.truck_number) {
      const key =
        `recent-driver:${driverData.name}:${driverData.phone_number}`.toLowerCase();
      const existingTimestamp = localStorage.getItem(key);

      if (existingTimestamp) {
        const timestamp = parseInt(existingTimestamp, 10);
        const isRecent = Date.now() - timestamp < 5000; // Within last 5 seconds

        if (isRecent) {
          console.warn(
            "Preventing duplicate driver creation - similar driver was just created"
          );
          return null;
        }
      }

      // Mark this driver as recently created to prevent duplicates
      localStorage.setItem(key, Date.now().toString());

      // Clean up after 30 seconds
      setTimeout(() => {
        localStorage.removeItem(key);
      }, 30000);
    }

    // Call server action
    console.log("Creating driver:", driverData.name);
    const driver = await createDriverAction(driverData);

    // Set a special flag to help real-time handler identify this driver
    if (driver && driver.id) {
      try {
        localStorage.setItem(
          `driver:created-by-form:${driver.id}`,
          Date.now().toString()
        );
        console.log(`✓ Marked driver ${driver.id} as created by form`);

        // Clean up after 10 seconds
        setTimeout(() => {
          localStorage.removeItem(`driver:created-by-form:${driver.id}`);
        }, 10000);
      } catch (e) {
        console.error("Error setting localStorage flag:", e);
      }
    }

    // Invalidate client caches
    try {
      await deleteClientCache("drivers:client-list");

      // Add a small delay to let server-side cache invalidate
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Force a revalidation of all paths related to drivers
      const result = await revalidateDriverPathsAction();
      console.log(`✓ Path revalidation result:`, result);
    } catch (e) {
      console.error("Cache invalidation error:", e);
    }

    return driver;
  } catch (error) {
    console.error("Error in createDriver client action:", error);
    throw error;
  }
}

// Update a driver
export async function updateDriver(
  driverId: number,
  driverData: Partial<Driver>
): Promise<{ success: boolean; driver?: Driver; error?: string }> {
  const result = await updateDriverAction(driverId, driverData);

  // Invalidate client caches
  try {
    await deleteClientCache("drivers:client-list");
    await deleteClientCache(`driver:client-${driverId}`);
  } catch (error) {
    console.error("Error invalidating client cache:", error);
  }

  return result;
}

// Delete a driver
export async function deleteDriver(
  driverId: number
): Promise<{ success: boolean; deletedDriverName?: string }> {
  try {
    // First mark as deleted in localStorage to handle refresh issues
    const driverIdStr = String(driverId);

    // Store in localStorage to persist through refreshes
    try {
      // Add to deleted drivers list
      const storedIds = JSON.parse(
        localStorage.getItem("deleted-driver-ids") || "[]"
      );
      if (!storedIds.includes(driverIdStr)) {
        localStorage.setItem(
          "deleted-driver-ids",
          JSON.stringify([...storedIds, driverIdStr])
        );
        console.log(`Added driver ${driverId} to known deleted drivers list`);
      }
    } catch (localStorageError) {
      console.error(
        "Error updating deleted drivers in localStorage:",
        localStorageError
      );
    }

    // Call server action to actually delete the driver
    const result = await deleteDriverAction(driverId);

    // Invalidate client caches
    try {
      await deleteClientCache("drivers:client-list");
      await deleteClientCache(`driver:client-${driverId}`);

      // Also try to clear local storage cache
      try {
        localStorage.removeItem(`driver:client-${driverId}`);
        localStorage.removeItem(`driver:client-${driverId}:timestamp`);
        localStorage.removeItem("drivers:client-list");
        localStorage.removeItem("drivers:client-list:timestamp");
      } catch (localStorageError) {
        console.error("Error clearing localStorage cache:", localStorageError);
      }
    } catch (error) {
      console.error("Error invalidating client cache:", error);
    }

    // Wait for revalidation to complete
    try {
      await revalidateDriverPathsAction();
      console.log("✅ All driver paths revalidated after deletion");
    } catch (error) {
      console.error("Error revalidating paths after driver deletion:", error);
    }

    return result;
  } catch (error) {
    console.error(
      `Error in deleteDriver client action for driver ${driverId}:`,
      error
    );
    return { success: false };
  }
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
  syncDriverWithStripeAction,
  revalidateDriverPathsAction,
} from "./server-actions";
