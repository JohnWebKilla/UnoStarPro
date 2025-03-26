import { Role } from "@/types/role";
import { createClient } from "@/utils/supabase/client";

const CACHE_PREFIX = "page_data:";
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

export interface PageData {
  path: string;
  data: any;
  lastFetched: string;
  expiresAt: number;
}

interface PageConfig {
  path: string;
  fetchFunction: () => Promise<any>;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") {
    return { "Cache-Control": "no-store" };
  }

  try {
    // Check if we have a user session in localStorage
    const userData = localStorage.getItem("userData");
    if (!userData) {
      return { "Cache-Control": "no-store" };
    }

    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      // Clear cached data on session error
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter((key) => key.startsWith("page_data:"));
      cacheKeys.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem("userData");
      return { "Cache-Control": "no-store" };
    }

    if (!session?.access_token) {
      // If no session but we have userData, clear everything
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(
        (key) =>
          key.startsWith("page_data:") ||
          key === "userData" ||
          key.includes("supabase") ||
          key.includes("auth")
      );
      cacheKeys.forEach((key) => localStorage.removeItem(key));
      return { "Cache-Control": "no-store" };
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      "Cache-Control": "no-store",
    };
  } catch (error) {
    console.error("Auth error:", error);
    // Don't throw error, just return basic headers
    return { "Cache-Control": "no-store" };
  }
}

async function fetchWithRedisCache(
  url: string,
  headers: Record<string, string>
) {
  const cacheKey = `api:${url}`;

  try {
    // Try to get from Redis first
    const cacheResponse = await fetch(
      "/api/cache?key=" + encodeURIComponent(cacheKey)
    );
    if (cacheResponse.ok) {
      const cachedData = await cacheResponse.json();
      if (cachedData) {
        return cachedData;
      }
    }

    // If not in Redis, fetch from API
    const response = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Store in Redis
    await fetch("/api/cache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: cacheKey,
        value: data,
        ttl: CACHE_TTL / 1000, // Convert to seconds for Redis
      }),
    });

    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

// Define page configurations for each role
const pageConfigs: Record<Role, PageConfig[]> = {
  admin: [
    {
      path: "/Dashboard",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/dashboard", headers);
      },
    },
    {
      path: "/Users",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        const data = await fetchWithRedisCache("/api/users", headers);
        return data.users;
      },
    },
    {
      path: "/Companies",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/companies", headers);
      },
    },
    {
      path: "/Drivers",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/drivers", headers);
      },
    },
    {
      path: "/Paychecks",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        const currentDate = new Date();
        const month = currentDate.toISOString().slice(0, 7); // Format: YYYY-MM
        return fetchWithRedisCache(
          `/api/payroll/monthly-summary?month=${month}`,
          headers
        );
      },
    },
    {
      path: "/Expenses",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        const currentDate = new Date();
        const month = currentDate.toISOString().slice(0, 7); // Format: YYYY-MM
        return Promise.all([
          fetchWithRedisCache(`/api/expenses?month=${month}`, headers),
          fetchWithRedisCache(`/api/expenses/chart?month=${month}`, headers),
        ]);
      },
    },
    {
      path: "/Scheduling",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/scheduling", headers);
      },
    },
  ],
  superadmin: [
    {
      path: "/Dashboard",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/dashboard", headers);
      },
    },
    {
      path: "/Users",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        const data = await fetchWithRedisCache("/api/users", headers);
        return data.users;
      },
    },
    {
      path: "/Companies",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/companies", headers);
      },
    },
    {
      path: "/Drivers",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/drivers", headers);
      },
    },
    {
      path: "/Paychecks",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        const currentDate = new Date();
        const month = currentDate.toISOString().slice(0, 7);
        return fetchWithRedisCache(
          `/api/payroll/monthly-summary?month=${month}`,
          headers
        );
      },
    },
    {
      path: "/Expenses",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        const currentDate = new Date();
        const month = currentDate.toISOString().slice(0, 7);
        return Promise.all([
          fetchWithRedisCache(`/api/expenses?month=${month}`, headers),
          fetchWithRedisCache(`/api/expenses/chart?month=${month}`, headers),
        ]);
      },
    },
    {
      path: "/Scheduling",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/scheduling", headers);
      },
    },
  ],
  customer: [
    {
      path: "/Dashboard",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/dashboard", headers);
      },
    },
    {
      path: "/Scheduling",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/scheduling", headers);
      },
    },
  ],
  user: [
    {
      path: "/Dashboard",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/dashboard", headers);
      },
    },
    {
      path: "/Scheduling",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/scheduling", headers);
      },
    },
  ],
  driver: [
    {
      path: "/Dashboard",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/dashboard", headers);
      },
    },
    {
      path: "/Scheduling",
      fetchFunction: async () => {
        const headers = await getAuthHeaders();
        return fetchWithRedisCache("/api/scheduling", headers);
      },
    },
  ],
};

export class ClientCacheManager {
  private role: Role;
  private isClient: boolean;
  private prefetchPromise: Promise<void> | null = null;

  constructor(role: Role) {
    this.role = role;
    this.isClient = typeof window !== "undefined";
  }

  private getCacheKey(path: string): string {
    return `${CACHE_PREFIX}${this.role}:${path}`;
  }

  private isDataExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt;
  }

  async prefetchAllData(): Promise<void> {
    if (!this.isClient || this.prefetchPromise) return;

    this.prefetchPromise = (async () => {
      const configs = pageConfigs[this.role] || [];
      await Promise.all(
        configs.map(async (config) => {
          try {
            const data = await config.fetchFunction();
            if (data === null) return;

            const cacheEntry: PageData = {
              path: config.path,
              data,
              lastFetched: new Date().toISOString(),
              expiresAt: Date.now() + CACHE_TTL,
            };

            localStorage.setItem(
              this.getCacheKey(config.path),
              JSON.stringify(cacheEntry)
            );
          } catch (error) {
            console.error(`Error prefetching ${config.path}:`, error);
          }
        })
      );
    })();

    return this.prefetchPromise;
  }

  async isPrefetchComplete(): Promise<boolean> {
    if (!this.prefetchPromise) return false;
    try {
      await this.prefetchPromise;
      return true;
    } catch {
      return false;
    }
  }

  async getPageData(path: string): Promise<any> {
    if (!this.isClient) return null;

    const cacheKey = this.getCacheKey(path);
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const parsed: PageData = JSON.parse(cachedData);
        if (!this.isDataExpired(parsed.expiresAt)) {
          return parsed.data;
        }
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.error("Error parsing cached data:", error);
        localStorage.removeItem(cacheKey);
      }
    }

    const config = pageConfigs[this.role]?.find((cfg) => cfg.path === path);
    if (!config) return null;

    try {
      const data = await config.fetchFunction();
      if (data === null) return null;

      const cacheEntry: PageData = {
        path,
        data,
        lastFetched: new Date().toISOString(),
        expiresAt: Date.now() + CACHE_TTL,
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      return data;
    } catch (error) {
      console.error(`Error fetching data for ${path}:`, error);
      return null;
    }
  }

  clearCache(): void {
    if (!this.isClient) return;
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    cacheKeys.forEach((key) => localStorage.removeItem(key));
    this.prefetchPromise = null;
  }

  clearPageCache(path: string): void {
    if (!this.isClient) return;
    const cacheKey = this.getCacheKey(path);
    localStorage.removeItem(cacheKey);
  }

  async verifyCacheStatus(): Promise<{
    isReady: boolean;
    missingPaths: string[];
  }> {
    if (!this.isClient) {
      return { isReady: false, missingPaths: [] };
    }

    const configs = pageConfigs[this.role] || [];
    const missingPaths: string[] = [];

    for (const config of configs) {
      const cacheKey = this.getCacheKey(config.path);
      const cachedData = localStorage.getItem(cacheKey);

      if (!cachedData) {
        missingPaths.push(config.path);
        continue;
      }

      try {
        const parsed = JSON.parse(cachedData);
        if (this.isDataExpired(parsed.expiresAt)) {
          missingPaths.push(config.path);
        }
      } catch (error) {
        console.error(`Error parsing cache for ${config.path}:`, error);
        missingPaths.push(config.path);
      }
    }

    return {
      isReady: missingPaths.length === 0,
      missingPaths,
    };
  }
}

// Exported functions for page data management
export async function getPageData(
  userEmail: string,
  path: string
): Promise<PageData | null> {
  const cacheKey = `${CACHE_PREFIX}${userEmail}:${path}`;
  const cachedData = localStorage.getItem(cacheKey);

  if (!cachedData) {
    return null;
  }

  try {
    const pageData: PageData = JSON.parse(cachedData);
    if (pageData.expiresAt < Date.now()) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return pageData;
  } catch (error) {
    console.error("Error parsing cached data:", error);
    localStorage.removeItem(cacheKey);
    return null;
  }
}

export async function refreshPageData(
  userEmail: string,
  role: Role,
  path: string
): Promise<void> {
  const config = pageConfigs[role]?.find((cfg) => cfg.path === path);
  if (!config) {
    throw new Error(`No configuration found for path: ${path}`);
  }

  try {
    const data = await config.fetchFunction();
    const pageData: PageData = {
      path,
      data,
      lastFetched: new Date().toISOString(),
      expiresAt: Date.now() + CACHE_TTL,
    };

    localStorage.setItem(
      `${CACHE_PREFIX}${userEmail}:${path}`,
      JSON.stringify(pageData)
    );
  } catch (error) {
    console.error(`Error refreshing page data for ${path}:`, error);
    throw error;
  }
}
