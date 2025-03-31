"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { setCache, getCache } from "@/lib/redis";
import { clearDriverCache, clearDriverListCache } from "./cache";
import { Driver } from "./types";
import {
  DRIVER_LIST_KEY,
  DRIVER_DETAIL_KEY,
  DRIVER_DOCUMENTS_KEY,
  CACHE_EXPIRATION,
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
    // Try to get from cache first - do this before creating supabase client to save time
    const cachedDrivers = await getCache<Driver[]>(DRIVER_LIST_KEY);

    if (cachedDrivers) {
      console.log("Using cached drivers from Redis");
      const endTime = Date.now();
      console.log(`Drivers fetched from cache in ${endTime - startTime}ms`);
      return cachedDrivers;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get drivers with their documents and company information
    const queryStartTime = Date.now();

    // Load drivers with company data
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

    // Prepare driver IDs for batch document fetching
    const driverIds = drivers.map((driver) => driver.id);

    // Batch fetch all documents at once instead of per driver
    const [
      { data: allLicenses },
      { data: allMedicalCards },
      { data: allMvrRecords },
    ] = await Promise.all([
      supabase.from("driver_licenses").select("*").in("driver_id", driverIds),
      supabase.from("medical_cards").select("*").in("driver_id", driverIds),
      supabase.from("mvr_records").select("*").in("driver_id", driverIds),
    ]);

    // Index the documents by driver_id for faster lookups
    const licensesByDriverId = groupBy(allLicenses || [], "driver_id");
    const medicalCardsByDriverId = groupBy(allMedicalCards || [], "driver_id");
    const mvrRecordsByDriverId = groupBy(allMvrRecords || [], "driver_id");

    // Map drivers with their documents (no more async calls inside the map)
    const driversWithDocs = drivers.map((driver) => ({
      ...driver,
      company_name: driver.companies?.name || "N/A",
      driver_licenses: licensesByDriverId[driver.id] || [],
      medical_cards: medicalCardsByDriverId[driver.id] || [],
      mvr_files: mvrRecordsByDriverId[driver.id] || [],
    })) as Driver[];

    const queryEndTime = Date.now();
    console.log(`Database query took ${queryEndTime - queryStartTime}ms`);

    // Cache the result
    await setCache(DRIVER_LIST_KEY, driversWithDocs, CACHE_EXPIRATION);

    const endTime = Date.now();
    console.log(`Drivers fetched and cached in ${endTime - startTime}ms`);

    return driversWithDocs;
  } catch (error) {
    console.error("Error fetching drivers:", error);
    throw error;
  }
}

// Helper function to group array items by a key
function groupBy<T extends Record<string, any>>(
  array: T[],
  key: string
): Record<string, T[]> {
  return array.reduce((result: Record<string, T[]>, item: T) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}

// Get a single driver with documents by ID
export async function getDriverAction(
  driverId: number
): Promise<Driver | null> {
  const startTime = Date.now();
  console.log(`Fetching driver ${driverId}...`);

  try {
    // Try to get from cache first - do this before creating supabase client
    const cacheKey = DRIVER_DETAIL_KEY(driverId);
    const cachedDriver = await getCache<Driver>(cacheKey);

    if (cachedDriver) {
      console.log(`Using cached driver ${driverId} from Redis`);
      const endTime = Date.now();
      console.log(`Driver fetched from cache in ${endTime - startTime}ms`);
      return cachedDriver;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get driver with company data in a single query
    const { data: driver, error } = await supabase
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
      .eq("id", driverId)
      .single();

    if (error) {
      throw error;
    }

    if (!driver) {
      return null;
    }

    // Fetch all documents in parallel
    const [{ data: licenses }, { data: medicalCards }, { data: mvrRecords }] =
      await Promise.all([
        supabase.from("driver_licenses").select("*").eq("driver_id", driverId),
        supabase.from("medical_cards").select("*").eq("driver_id", driverId),
        supabase.from("mvr_records").select("*").eq("driver_id", driverId),
      ]);

    const driverWithDocs = {
      ...driver,
      company_name: driver.companies?.name || "N/A",
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
