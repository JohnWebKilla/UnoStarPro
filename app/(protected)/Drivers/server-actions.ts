"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { setCache, getCache } from "@/lib/redis";
import {
  DRIVER_LIST_KEY,
  DRIVER_DETAIL_KEY,
  DRIVER_DOCUMENTS_KEY,
  CACHE_EXPIRATION,
  clearDriverCache,
  clearDriverListCache,
} from "./cache";
import { Driver, Document } from "./types";
import {
  DRIVER_LIST_KEY as DRIVER_LIST_KEY_CONST,
  DRIVER_DETAIL_KEY as DRIVER_DETAIL_KEY_CONST,
  DRIVER_DOCUMENTS_KEY as DRIVER_DOCUMENTS_KEY_CONST,
} from "./constants";

// Helper function for retrying database operations
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }
  throw lastError;
}

// Get drivers with their documents
export async function getDriversAction(): Promise<Driver[]> {
  const startTime = Date.now();
  console.log("Fetching drivers...");

  try {
    const supabase = await createClient();

    // Try to get from cache first
    const cachedDrivers = await getCache<Driver[]>(DRIVER_LIST_KEY_CONST);

    if (cachedDrivers) {
      console.log("Using cached drivers from Redis");
      const endTime = Date.now();
      console.log(`Drivers fetched from cache in ${endTime - startTime}ms`);
      return cachedDrivers;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get drivers with their documents and company information
    const queryStartTime = Date.now();

    const { data: drivers, error: driversError } = await withRetry(
      async () => {
        return await supabase
          .from("drivers")
          .select(
            `
            *,
            companies:company_id (
              id,
              name
            )
          `
          )
          .order("created_at", { ascending: false });
      },
      3,
      500
    );

    if (driversError) {
      throw driversError;
    }

    // If we have drivers, try to fetch their documents
    const driversWithDocs = await Promise.all(
      drivers.map(async (driver) => {
        try {
          // Fetch licenses
          const { data: licenses } = await supabase
            .from("driver_licenses")
            .select("*")
            .eq("driver_id", driver.id)
            .then((res) => res || { data: [] });

          // Fetch medical cards
          const { data: medicalCards } = await supabase
            .from("medical_cards")
            .select("*")
            .eq("driver_id", driver.id)
            .then((res) => res || { data: [] });

          // Fetch MVR records
          const { data: mvrRecords } = await supabase
            .from("mvr_records")
            .select("*")
            .eq("driver_id", driver.id)
            .then((res) => res || { data: [] });

          return {
            ...driver,
            company_name: driver.companies?.name || "N/A",
            driver_licenses: licenses || [],
            medical_cards: medicalCards || [],
            mvr_files: mvrRecords || [],
          } as Driver;
        } catch (error) {
          console.error(
            `Error fetching documents for driver ${driver.id}:`,
            error
          );
          return {
            ...driver,
            company_name: driver.companies?.name || "N/A",
            driver_licenses: [],
            medical_cards: [],
            mvr_files: [],
          } as Driver;
        }
      })
    );

    const queryEndTime = Date.now();
    console.log(`Database query took ${queryEndTime - queryStartTime}ms`);

    // Cache the result
    await setCache(DRIVER_LIST_KEY_CONST, driversWithDocs, CACHE_EXPIRATION);

    const endTime = Date.now();
    console.log(`Drivers fetched and cached in ${endTime - startTime}ms`);

    return driversWithDocs;
  } catch (error) {
    console.error("Error fetching drivers:", error);
    throw error;
  }
}

// Get a single driver with documents by ID
export async function getDriverAction(
  driverId: number
): Promise<Driver | null> {
  const startTime = Date.now();
  console.log(`Fetching driver ${driverId}...`);

  try {
    const supabase = await createClient();

    // Try to get from cache first
    const cacheKey = DRIVER_DETAIL_KEY_CONST(driverId);
    const cachedDriver = await getCache<Driver>(cacheKey);

    if (cachedDriver) {
      console.log(`Using cached driver ${driverId} from Redis`);
      const endTime = Date.now();
      console.log(`Driver fetched from cache in ${endTime - startTime}ms`);
      return cachedDriver;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get driver by ID
    const { data: driver, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", driverId)
      .single();

    if (error) {
      throw error;
    }

    if (!driver) {
      return null;
    }

    // Fetch driver documents
    const [{ data: licenses }, { data: medicalCards }, { data: mvrRecords }] =
      await Promise.all([
        supabase.from("driver_licenses").select("*").eq("driver_id", driverId),
        supabase.from("medical_cards").select("*").eq("driver_id", driverId),
        supabase.from("mvr_records").select("*").eq("driver_id", driverId),
      ]);

    const driverWithDocs = {
      ...driver,
      driver_licenses: licenses || [],
      medical_cards: medicalCards || [],
      mvr_files: mvrRecords || [],
    } as Driver;

    // Cache the result
    await setCache(cacheKey, driverWithDocs, CACHE_EXPIRATION);

    const endTime = Date.now();
    console.log(`Driver fetched and cached in ${endTime - startTime}ms`);

    return driverWithDocs;
  } catch (error) {
    console.error(`Error fetching driver ${driverId}:`, error);
    return null;
  }
}

// Create a new driver
export async function createDriverAction(
  driverData: Partial<Driver>
): Promise<Driver | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Set default values
    if (!driverData.hire_date) {
      driverData.hire_date = new Date().toISOString();
    }

    if (driverData.subscription_amount === undefined) {
      driverData.subscription_amount = 0;
    }

    // Insert driver
    const { data, error } = await supabase
      .from("drivers")
      .insert(driverData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Clear driver list cache
    await clearDriverListCache();

    // Revalidate the drivers page
    revalidatePath("/Drivers");

    return data as Driver;
  } catch (error) {
    console.error("Error creating driver:", error);
    return null;
  }
}

// Update a driver
export async function updateDriverAction(
  driverId: number,
  driverData: Partial<Driver>
): Promise<Driver | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Update driver
    const { data, error } = await supabase
      .from("drivers")
      .update(driverData)
      .eq("id", driverId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Clear caches
    await clearDriverCache(driverId);
    await clearDriverListCache();

    // Revalidate the drivers page
    revalidatePath("/Drivers");

    return data as Driver;
  } catch (error) {
    console.error(`Error updating driver ${driverId}:`, error);
    return null;
  }
}

// Delete a driver
export async function deleteDriverAction(driverId: number): Promise<boolean> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Delete from all related tables first
    await Promise.all([
      supabase.from("driver_licenses").delete().eq("driver_id", driverId),
      supabase.from("medical_cards").delete().eq("driver_id", driverId),
      supabase.from("mvr_records").delete().eq("driver_id", driverId),
    ]);

    // Delete the driver
    const { error } = await supabase
      .from("drivers")
      .delete()
      .eq("id", driverId);

    if (error) {
      throw error;
    }

    // Clear caches
    await clearDriverCache(driverId);
    await clearDriverListCache();

    // Revalidate the drivers page
    revalidatePath("/Drivers");

    return true;
  } catch (error) {
    console.error(`Error deleting driver ${driverId}:`, error);
    return false;
  }
}

// Add a function to clear all driver caches
export async function clearDriverCachesAction(): Promise<boolean> {
  try {
    await clearDriverListCache();
    console.log("All driver caches cleared");
    return true;
  } catch (error) {
    console.error("Error clearing driver caches:", error);
    return false;
  }
}
