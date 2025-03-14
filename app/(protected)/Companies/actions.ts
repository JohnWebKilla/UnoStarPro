"use client";

import { Company } from "./types";
import { getClientCache, setClientCache } from "@/utils/client-cache";
import {
  getCompaniesAction,
  createCompanyAction,
  updateCompanyAction,
  deleteCompanyAction,
} from "./server-actions";
import { invalidateStripeCache } from "@/lib/redis-client";

export async function getCompanies(skipCache: boolean = false): Promise<{
  data: Company[];
  source: "cache" | "database";
  timing: { total: number; database?: number; source?: string };
}> {
  const startTime = performance.now();

  // Try to get from cache if not skipping
  if (!skipCache) {
    try {
      const result = await getClientCache<Company[]>("companies:list");
      if (result.data) {
        const endTime = performance.now();
        return {
          data: result.data,
          source: "cache",
          timing: { total: endTime - startTime, source: "cache" },
        };
      }
    } catch (cacheError) {
      console.error("Cache error:", cacheError);
      // Continue to database fetch if cache fails
    }
  }

  // Fetch from database
  const dbStartTime = performance.now();
  const companies = await getCompaniesAction();

  // Try to cache the data, but don't fail if cache fails
  try {
    await setClientCache("companies:list", companies);
  } catch (cacheError) {
    console.error("Failed to set cache:", cacheError);
  }

  const endTime = performance.now();
  return {
    data: companies,
    source: "database",
    timing: {
      total: endTime - startTime,
      database: endTime - dbStartTime,
      source: "database",
    },
  };
}

export async function createCompany(
  companyData: Partial<Company>
): Promise<Company> {
  const data = await createCompanyAction(companyData);
  // Invalidate cache
  await setClientCache("companies:list", null);
  return data;
}

export async function updateCompany(
  id: number,
  companyData: Partial<Company>
): Promise<Company> {
  const data = await updateCompanyAction(id, companyData);
  // Invalidate cache
  await setClientCache("companies:list", null);
  return data;
}

export async function deleteCompany(id: number): Promise<void> {
  try {
    // First try to delete from database
    await deleteCompanyAction(id);

    // Only clear cache if database deletion was successful
    try {
      await setClientCache("companies:list", null);
    } catch (cacheError) {
      console.error("Failed to clear cache:", cacheError);
      // Don't throw here, as the main operation succeeded
    }
  } catch (error) {
    // Propagate the error with its original message
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to delete company");
  }
}

export async function clearCompanyCache(companyId: number) {
  try {
    await invalidateStripeCache(companyId);
    return { success: true, message: "Cache cleared successfully" };
  } catch (error) {
    console.error("Error clearing company cache:", error);
    return {
      success: false,
      message: "Failed to clear cache",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
