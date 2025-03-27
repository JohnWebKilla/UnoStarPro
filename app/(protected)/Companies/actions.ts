"use client";

import { Company } from "./types";
import {
  getCompaniesAction,
  createCompanyAction,
  updateCompanyAction,
  deleteCompanyAction,
  invalidateCompaniesCache,
} from "./server-actions";
import { setCache } from "@/lib/redis-manager";

export async function getCompanies(skipCache: boolean = false): Promise<{
  data: Company[];
  source: "cache" | "database";
  timing: { total: number; database?: number; source?: string };
}> {
  console.log("Fetching companies, skipCache:", skipCache);

  try {
    if (skipCache) {
      // Invalidate cache first if skipCache is true
      await invalidateCompaniesCache();
    }

    const result = await getCompaniesAction();
    console.log(
      `Loaded ${result.data.length} companies from ${result.source} in ${result.timing.total.toFixed(0)}ms`
    );

    // Add additional logging for debugging
    if (result.source === "cache") {
      console.log("Successfully loaded companies from cache");
    } else {
      console.log("Successfully loaded companies from database");
    }

    return result;
  } catch (error) {
    console.error("Error fetching companies:", error);
    throw error;
  }
}

export async function createCompany(
  companyData: Partial<Company>
): Promise<Company> {
  const data = await createCompanyAction(companyData);
  // Invalidate cache after creating a company
  await invalidateCompaniesCache();
  return data;
}

export async function updateCompany(
  id: number,
  companyData: Partial<Company>
): Promise<Company> {
  const data = await updateCompanyAction(id, companyData);
  // Invalidate cache after updating a company
  await invalidateCompaniesCache();
  return data;
}

export async function deleteCompany(id: number): Promise<void> {
  try {
    await deleteCompanyAction(id);
    // Invalidate cache after deleting a company
    await invalidateCompaniesCache();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to delete company");
  }
}

export async function clearCompanyCache(companyId?: number): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    await invalidateCompaniesCache();
    if (companyId) {
      // Clear company-specific caches
      const stripeKey = `stripe_data:${companyId}`;
      const usersKey = `company_users:${companyId}`;
      await Promise.all([
        setCache(stripeKey, null, 0),
        setCache(usersKey, null, 0),
      ]);
    }
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
