"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { setCache, getCache } from "@/lib/redis";
import { clearDriverCache, clearDriverListCache } from "./cache";
import { Driver, NameMatchSuggestion } from "./types";
import {
  DRIVER_LIST_KEY,
  DRIVER_DETAIL_KEY,
  DRIVER_DOCUMENTS_KEY,
  CACHE_EXPIRATION,
} from "./constants";
import {
  updateDriverInStripe,
  syncStripeProductsWithNameMatching,
  approveStripeProductMatch,
  syncDriverWithStripe,
} from "./stripe-actions";
import Stripe from "stripe";
import { calculateNameSimilarity } from "@/lib/utils";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

async function initStripe(): Promise<Stripe | null> {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Missing STRIPE_SECRET_KEY");
    return null;
  }
  return stripeClient;
}

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
    // Try to get from cache first using Redis
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

    // Validate required fields
    if (
      !driverData.name ||
      !driverData.phone_number ||
      !driverData.truck_number
    ) {
      throw new Error("Missing required fields");
    }

    // Create the driver with company_id if provided
    const { data: driver, error } = await supabase
      .from("drivers")
      .insert({
        name: driverData.name,
        phone_number: driverData.phone_number,
        truck_number: driverData.truck_number,
        solo_or_team: driverData.solo_or_team || "solo",
        subscription_amount: driverData.subscription_amount || 0,
        company_id: driverData.company_id,
        status: "pending",
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    // Clear cache after creating a new driver
    await clearDriverListCache();

    return driver;
  } catch (error) {
    console.error("Error creating driver:", error);
    throw error;
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
    console.log("Clearing all driver caches");

    // Clear Redis cache
    await clearDriverListCache();

    // Trigger revalidation of the Drivers path
    revalidatePath("/Drivers");

    console.log("All driver caches cleared");
    return true;
  } catch (error) {
    console.error("Error clearing driver caches:", error);
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
    subscription_amount?: string | number;
    company_id?: string | number;
    [key: string]: any;
  }>,
  columnMapping: {
    name?: string;
    phone_number?: string;
    truck_number?: string;
    solo_or_team?: string;
    subscription_amount?: string;
    company_id?: string;
  }
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const errors: string[] = [];
  let importedCount = 0;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Process each row
    const driversToCreate = data.map((row) => {
      const companyIdValue = row[columnMapping.company_id || "company_id"];
      const companyId = companyIdValue
        ? parseInt(String(companyIdValue), 10)
        : undefined;

      const driverData: Partial<Driver> = {
        name: row[columnMapping.name || "name"] || "",
        phone_number: row[columnMapping.phone_number || "phone_number"] || "",
        truck_number: row[columnMapping.truck_number || "truck_number"] || "",
        solo_or_team: (
          row[columnMapping.solo_or_team || "solo_or_team"] || "solo"
        ).toLowerCase() as "solo" | "team",
        subscription_amount:
          parseFloat(
            String(
              row[columnMapping.subscription_amount || "subscription_amount"]
            )
          ) || 0,
        company_id: companyId,
        status: "pending",
      };

      return driverData;
    });

    // Filter out invalid entries
    const validDrivers = driversToCreate.filter((driver) => {
      if (!driver.name || !driver.phone_number || !driver.truck_number) {
        errors.push(
          `Missing required fields for driver: ${driver.name || "Unknown"}`
        );
        return false;
      }
      return true;
    });

    if (validDrivers.length === 0) {
      return { success: false, imported: 0, errors };
    }

    // Insert all valid drivers
    const { data: createdDrivers, error } = await supabase
      .from("drivers")
      .insert(validDrivers)
      .select();

    if (error) {
      throw error;
    }

    importedCount = createdDrivers?.length || 0;

    // Clear cache after importing drivers
    await clearDriverListCache();

    return {
      success: true,
      imported: importedCount,
      errors,
    };
  } catch (error) {
    console.error("Error importing drivers:", error);
    errors.push(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
    return {
      success: false,
      imported: importedCount,
      errors,
    };
  }
}

// Optimized function specifically for status updates
export async function updateDriverStatusAction(
  driverId: number,
  newStatus: "active" | "inactive" | "terminated" | "pending"
): Promise<{ success: boolean; error?: string }> {
  console.log(`Server: Updating driver ${driverId} status to ${newStatus}`);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Update the driver status
    const { data: updatedDriver, error: updateError } = await withRetry(
      async () => {
        return await supabase
          .from("drivers")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", driverId)
          .select()
          .single();
      },
      3,
      500
    );

    if (updateError) {
      console.error("Error updating driver status:", updateError);
      throw updateError;
    }

    if (!updatedDriver) {
      throw new Error("Failed to update driver status");
    }

    // Clear both list and individual driver cache
    await Promise.all([clearDriverCache(driverId), clearDriverListCache()]);

    console.log(
      `Server: Successfully updated driver ${driverId} status to ${newStatus}`
    );
    return { success: true };
  } catch (error) {
    console.error("Error in updateDriverStatusAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update driver status",
    };
  }
}

// Batch update function for driver statuses
export async function updateDriverStatusBatchAction(
  driverIds: number[],
  newStatus: "active" | "inactive" | "terminated" | "pending"
): Promise<{ success: boolean; error?: string; updatedDrivers?: Driver[] }> {
  console.log(
    `Server: Batch updating ${driverIds.length} drivers status to ${newStatus}`
  );

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // Update all drivers' status in a single query
    const { data: updatedDrivers, error: updateError } = await withRetry(
      async () => {
        return await supabase
          .from("drivers")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .in("id", driverIds)
          .select("*"); // Select all fields to get the complete updated records
      },
      3,
      500
    );

    if (updateError) {
      console.error("Error batch updating driver statuses:", updateError);
      throw updateError;
    }

    if (!updatedDrivers || updatedDrivers.length === 0) {
      throw new Error("Failed to update driver statuses");
    }

    // Clear both list and individual driver caches
    await Promise.all([
      ...driverIds.map((id) => clearDriverCache(id)),
      clearDriverListCache(),
    ]);

    console.log(
      `Server: Successfully updated ${updatedDrivers.length} drivers status to ${newStatus}`
    );
    return { success: true, updatedDrivers };
  } catch (error) {
    console.error("Error in updateDriverStatusBatchAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update driver statuses",
    };
  }
}

async function getAllStripeProducts(): Promise<Stripe.Product[]> {
  const allProducts: Stripe.Product[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripeClient.products.list({
      limit: 100,
      starting_after: startingAfter,
    });

    allProducts.push(...response.data);
    hasMore = response.has_more;
    startingAfter = response.data[response.data.length - 1]?.id;

    if (hasMore) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit delay
    }
  }

  return allProducts;
}

async function getDriversWithoutStripeId() {
  const supabase = await createClient();
  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("*")
    .is("stripe_product_id", null);

  if (error) throw error;
  if (!drivers) return [];
  return drivers;
}

export async function syncStripeWithNameMatchingAction(driver: Driver) {
  const stripe = await initStripe();
  if (!stripe) {
    return { success: false, message: "Failed to initialize Stripe client" };
  }

  try {
    // Rest of the function implementation
    // ... existing code ...
  } catch (error) {
    console.error("Error syncing with Stripe:", error);
    return { success: false, message: "Failed to sync with Stripe" };
  }
}

export async function createStripeProductsAction(): Promise<{
  success: boolean;
  message: string;
  progress?: {
    stage: "creating";
    message: string;
    progress: number;
    total: number;
    currentItem?: string;
  };
}> {
  const stripeClient = await initStripe();
  if (!stripeClient) {
    return {
      success: false,
      message: "Stripe client is not initialized",
    };
  }

  try {
    const drivers = await getDriversWithoutStripeId();

    return {
      success: true,
      message: "Creating Stripe products",
      progress: {
        stage: "creating",
        message: "Creating Stripe products",
        progress: 0,
        total: drivers.length,
        currentItem: drivers[0]?.name || "",
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to create Stripe products",
    };
  }
}

export async function approveStripeMatchAction(
  driverId: number,
  stripeProductId: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log(
      `Approving match for driver ${driverId} with product ${stripeProductId}`
    );
    const result = await approveStripeProductMatch(driverId, stripeProductId);
    console.log("Match approval result:", result);

    revalidatePath("/Drivers");

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    console.error("Error in approveStripeMatchAction:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// Add this new action near the other Stripe-related actions
export async function syncDriverWithStripeAction(driverId: number): Promise<{
  success: boolean;
  message: string;
  driver?: Driver;
}> {
  try {
    const supabase = await createClient();

    // Get driver data
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select()
      .eq("id", driverId)
      .single();

    if (driverError) throw driverError;
    if (!driver) throw new Error("Driver not found");

    // Call the syncDriverWithStripe function
    const result = await syncDriverWithStripe(driver);

    // Revalidate the drivers path
    revalidatePath("/Drivers");

    // Clear cache for this driver
    await clearDriverCache(driverId);

    // Return the result
    return result;
  } catch (error) {
    console.error("Error in syncDriverWithStripeAction:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
