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
import { updateDriverInStripe } from "./stripe-actions";

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
  id: number,
  driverData: Partial<Driver>
): Promise<Driver> {
  const supabase = await createClient();

  // First, get the current driver data
  const { data: existingDriver, error: fetchError } = await supabase
    .from("drivers")
    .select()
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  // Update in database
  const { data, error } = await supabase
    .from("drivers")
    .update({
      ...driverData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // If driver has Stripe connection and relevant fields were updated, sync with Stripe
  if (data.stripe_connect_account_id) {
    const relevantFields = ["name", "email", "phone_number", "status"];

    const hasRelevantChanges = Object.keys(driverData).some(
      (key) =>
        relevantFields.includes(key) &&
        driverData[key as keyof Driver] !== existingDriver[key as keyof Driver]
    );

    if (hasRelevantChanges) {
      try {
        await updateDriverInStripe(data);
      } catch (stripeError) {
        console.error("Failed to sync driver with Stripe:", stripeError);
      }
    }
  }

  revalidatePath("/Drivers");
  return data;
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
    // Clear server-side Redis cache
    await clearDriverListCache();

    // Return true to indicate success
    // The client component will handle IndexedDB clearing
    return true;
  } catch (error) {
    console.error("Error clearing caches:", error);
    return false;
  }
}

// Import drivers from JSON or CSV file
export async function importDriversFromFileAction(
  fileContent: string,
  fileType: "json" | "csv"
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const supabase = await createClient();
  const errors: string[] = [];
  let drivers: Partial<Driver>[] = [];

  try {
    if (fileType === "json") {
      drivers = JSON.parse(fileContent);
    } else {
      // Parse CSV
      const rows = fileContent.split("\n").map((row) => row.split(","));
      const headers = rows[0].map((h) => h.trim());

      drivers = rows.slice(1).map((row) => {
        const driver: any = {};
        headers.forEach((header, index) => {
          if (row[index]) {
            driver[header] = row[index].trim();
          }
        });
        return driver;
      });
    }

    const results = await Promise.all(
      drivers.map(async (driverData) => {
        try {
          // Validate required fields
          if (
            !driverData.name ||
            !driverData.phone_number ||
            !driverData.truck_number ||
            !driverData.solo_or_team
          ) {
            throw new Error(
              `Missing required fields for driver: ${driverData.name || "Unknown"}`
            );
          }

          // Create driver in database
          const { data: newDriver, error: dbError } = await supabase
            .from("drivers")
            .insert([
              {
                ...driverData,
                status: "pending",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
            .select()
            .single();

          if (dbError) throw dbError;

          // Sync with Stripe
          await updateDriverInStripe(newDriver);

          return { success: true };
        } catch (error: any) {
          return {
            success: false,
            error: `Failed to import driver ${driverData.name}: ${error.message || "Unknown error"}`,
          };
        }
      })
    );

    // Clear cache after import
    await clearDriverListCache();

    const successCount = results.filter((r) => r.success).length;
    const failedImports = results.filter((r) => !r.success);

    failedImports.forEach((result) => {
      if (result.error) errors.push(result.error);
    });

    return {
      success: true,
      imported: successCount,
      errors,
    };
  } catch (error: any) {
    console.error("Error importing drivers:", error);
    return {
      success: false,
      imported: 0,
      errors: [`Failed to process file: ${error.message || "Unknown error"}`],
    };
  }
}

// Batch create multiple drivers
export async function batchCreateDriversAction(
  drivers: Partial<Driver>[]
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const supabase = await createClient();
  const errors: string[] = [];
  let successCount = 0;

  try {
    const results = await Promise.all(
      drivers.map(async (driverData) => {
        try {
          // Validate required fields
          if (
            !driverData.name ||
            !driverData.phone_number ||
            !driverData.truck_number ||
            !driverData.solo_or_team
          ) {
            throw new Error(
              `Missing required fields for driver: ${driverData.name || "Unknown"}`
            );
          }

          // Create driver in database
          const { data: newDriver, error: dbError } = await supabase
            .from("drivers")
            .insert([
              {
                ...driverData,
                status: "pending",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ])
            .select()
            .single();

          if (dbError) throw dbError;

          // Sync with Stripe
          await updateDriverInStripe(newDriver);

          return { success: true };
        } catch (error: any) {
          return {
            success: false,
            error: `Failed to create driver ${driverData.name}: ${error.message || "Unknown error"}`,
          };
        }
      })
    );

    // Clear cache after batch creation
    await clearDriverListCache();

    successCount = results.filter((r) => r.success).length;
    const failedImports = results.filter((r) => !r.success);

    failedImports.forEach((result) => {
      if (result.error) errors.push(result.error);
    });

    return {
      success: true,
      imported: successCount,
      errors,
    };
  } catch (error: any) {
    console.error("Error creating drivers:", error);
    return {
      success: false,
      imported: successCount,
      errors: [
        `Failed to process drivers: ${error.message || "Unknown error"}`,
      ],
    };
  }
}

// Import drivers from raw data
export async function importDriversFromRawDataAction(
  data: Array<{
    name?: string;
    phone_number?: string;
    truck_number?: string;
    solo_or_team?: string;
    [key: string]: any;
  }>,
  columnMapping: {
    name?: string;
    phone_number?: string;
    truck_number?: string;
    solo_or_team?: string;
  }
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const supabase = await createClient();
  const errors: string[] = [];

  try {
    console.log("Raw data:", data);
    console.log("Column mapping:", columnMapping);

    const transformedData = data.map((item) => {
      const transformed = {
        name: columnMapping.name
          ? item[columnMapping.name]?.toString().trim()
          : "",
        phone_number: columnMapping.phone_number
          ? item[columnMapping.phone_number]
              ?.toString()
              .trim()
              .replace(/\s+/g, "")
          : "",
        truck_number: columnMapping.truck_number
          ? item[columnMapping.truck_number]
              ?.toString()
              .trim()
              .replace(/\s+/g, "")
          : "",
        solo_or_team: columnMapping.solo_or_team
          ? item[columnMapping.solo_or_team]
              ?.toString()
              .trim()
              .toLowerCase() === "team"
            ? "team"
            : "solo"
          : "solo",
        status: "pending" as const,
        subscription_amount: 0,
        company_id: null,
      };
      console.log("Transformed item:", transformed);
      return transformed;
    });

    console.log("All transformed data:", transformedData);

    // Process in batches of 4 to stay under rate limits
    const batchSize = 4;
    const results = [];

    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);

      // Process each batch
      const batchResults = await Promise.all(
        batch.map(async (driverData) => {
          try {
            // Validate required fields
            if (
              !driverData.name ||
              !driverData.phone_number ||
              !driverData.truck_number ||
              !driverData.solo_or_team
            ) {
              throw new Error(
                `Missing required fields for driver: ${driverData.name || "Unknown"}`
              );
            }

            console.log("Inserting driver:", driverData);

            // Create driver in database
            const { data: newDriver, error: dbError } = await supabase
              .from("drivers")
              .insert([
                {
                  ...driverData,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ])
              .select()
              .single();

            if (dbError) {
              console.error("Database error:", dbError);
              throw dbError;
            }

            // Sync with Stripe
            await updateDriverInStripe(newDriver);

            return { success: true };
          } catch (error: any) {
            console.error("Error processing driver:", error);
            return {
              success: false,
              error: `Failed to import driver ${driverData.name}: ${error.message || "Unknown error"}`,
            };
          }
        })
      );

      results.push(...batchResults);

      // Add delay between batches to respect rate limits (250ms = 4 requests per second)
      if (i + batchSize < transformedData.length) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    // Clear cache after import
    await clearDriverListCache();

    const successCount = results.filter((r) => r.success).length;
    const failedImports = results.filter((r) => !r.success);

    failedImports.forEach((result) => {
      if (result.error) errors.push(result.error);
    });

    return {
      success: true,
      imported: successCount,
      errors,
    };
  } catch (error: any) {
    console.error("Error importing drivers:", error);
    return {
      success: false,
      imported: 0,
      errors: [
        `Failed to process drivers: ${error.message || "Unknown error"}`,
      ],
    };
  }
}
