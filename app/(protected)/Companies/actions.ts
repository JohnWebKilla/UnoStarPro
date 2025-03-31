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
import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";

// Enhanced response type for cached data
export interface CompaniesApiResponse {
  data: Company[];
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source?: "client-cache" | "server" | "local-storage";
  };
}

export async function getCompanies(
  skipCache: boolean = false
): Promise<CompaniesApiResponse> {
  console.log("Fetching companies, skipCache:", skipCache);
  const startTime = performance.now();

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      // Directly check localStorage first as it's the fastest option
      try {
        const localData = localStorage.getItem("companies:client-list");
        if (localData) {
          const parsedData = JSON.parse(localData);
          // Check if data is fresh (less than 5 minutes old)
          const timestamp = localStorage.getItem(
            "companies:client-list:timestamp"
          );
          const dataAge = timestamp
            ? Date.now() - parseInt(timestamp, 10)
            : Infinity;

          if (dataAge < 5 * 60 * 1000) {
            // 5 minutes
            const endTime = performance.now();
            console.log("Using companies data from localStorage cache");
            return {
              data: parsedData,
              source: "cache",
              timing: {
                total: endTime - startTime,
                source: "local-storage",
              },
            };
          }
        }
      } catch (e) {
        // Silently continue if localStorage access fails
        console.log("localStorage access failed, continuing to API cache");
      }

      // Only check API cache if localStorage failed or had stale data
      try {
        const result = await getClientCache<Company[]>("companies:client-list");
        if (result.data) {
          // Update localStorage for next time
          try {
            localStorage.setItem(
              "companies:client-list",
              JSON.stringify(result.data)
            );
            localStorage.setItem(
              "companies:client-list:timestamp",
              Date.now().toString()
            );
          } catch (e) {
            console.error("Error saving to localStorage:", e);
          }

          const endTime = performance.now();
          console.log("Using companies data from client API cache");
          return {
            data: result.data,
            source: "cache",
            timing: {
              total: endTime - startTime,
              source: "client-cache",
            },
          };
        }
      } catch (cacheError) {
        console.error("Client API cache error:", cacheError);
      }
    } catch (cacheError) {
      console.error("Client cache error:", cacheError);
      // Continue to server fetch if cache fails
    }
  }

  try {
    if (skipCache) {
      // Invalidate cache first if skipCache is true
      await invalidateCompaniesCache();
    }

    // Fetch from server (which may use Redis cache)
    const dbStartTime = performance.now();
    const result = await getCompaniesAction();

    // Try to cache the data on client-side
    try {
      // Cache in API
      await setClientCache("companies:client-list", result.data);

      // Also cache in localStorage for faster retrieval next time
      try {
        localStorage.setItem(
          "companies:client-list",
          JSON.stringify(result.data)
        );
        localStorage.setItem(
          "companies:client-list:timestamp",
          Date.now().toString()
        );
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    } catch (cacheError) {
      console.error("Failed to set client cache:", cacheError);
    }

    console.log(
      `Loaded ${result.data.length} companies from ${result.source} in ${result.timing.total.toFixed(0)}ms`
    );

    // Add additional logging for debugging
    if (result.source === "cache") {
      console.log("Successfully loaded companies from server cache");
    } else {
      console.log("Successfully loaded companies from database");
    }

    const endTime = performance.now();
    return {
      ...result,
      timing: {
        ...result.timing,
        total: endTime - startTime,
        source: "server",
      },
    };
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
    // Clear server-side cache
    await invalidateCompaniesCache();

    // Clear client-side API cache
    await deleteClientCache("companies:client-list");

    // Clear localStorage
    try {
      localStorage.removeItem("companies:client-list");
      localStorage.removeItem("companies:client-list:timestamp");
    } catch (e) {
      console.error("Error clearing localStorage:", e);
    }

    if (companyId) {
      // Clear company-specific caches
      const stripeKey = `stripe_data:${companyId}`;
      const usersKey = `company_users:${companyId}`;

      // Server-side cache
      await Promise.all([
        setCache(stripeKey, null, 0),
        setCache(usersKey, null, 0),
      ]);

      // Client-side cache
      await Promise.all([
        deleteClientCache(stripeKey),
        deleteClientCache(usersKey),
      ]);

      // Clear localStorage for specific company
      try {
        localStorage.removeItem(`company:${companyId}`);
        localStorage.removeItem(`company:${companyId}:timestamp`);
        localStorage.removeItem(`company_users:${companyId}`);
        localStorage.removeItem(`company_users:${companyId}:timestamp`);
      } catch (e) {
        console.error("Error clearing company-specific localStorage:", e);
      }
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
