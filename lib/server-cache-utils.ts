import { getCache, setCache } from "./redis";
import { Role } from "@/types/role";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export const CACHE_TTL = 3600; // 1 hour

export interface CacheConfig {
  prefix: string;
  ttl?: number;
}

export interface CachedResponse<T> {
  data: T;
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source?: "client-cache" | "server" | "local-storage";
  };
}

export const createCacheKey = (
  prefix: string,
  identifier?: string | number
) => {
  return `api:/api/${prefix}${identifier ? `/${identifier}` : ""}`;
};

export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const data = await getCache<T>(key);
    return data;
  } catch (error) {
    console.error(`Error getting from cache for key ${key}:`, error);
    return null;
  }
}

export async function setToCache<T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    await setCache(key, data, ttl);
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await setCache(key, null, 0);
  } catch (error) {
    console.error(`Error invalidating cache for key ${key}:`, error);
  }
}

export async function cacheCommonData(
  userId: string,
  role: Role
): Promise<void> {
  const cookieStore = cookies();
  const month = new Date().toISOString().slice(0, 7);
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().slice(0, 7);

  // Define all cache operations based on role
  const cacheOperations = [];

  // Admin and superadmin specific caching
  if (role === "admin" || role === "superadmin") {
    // Cache users
    cacheOperations.push(async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase.from("users").select("*").limit(100);
        if (data) {
          await setToCache(`users:list:${userId}`, data);
          await setToCache(`api:/api/users`, data);
        }
      } catch (error) {
        console.error("Error caching users:", error);
      }
    });

    // Cache companies
    cacheOperations.push(async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from("companies")
          .select("*")
          .limit(100);
        if (data) {
          await setToCache("companies:list", data);
          await setToCache(`api:/api/companies`, data);
        }
      } catch (error) {
        console.error("Error caching companies:", error);
      }
    });

    // Cache drivers
    cacheOperations.push(async () => {
      try {
        const supabase = await createClient();
        const { data } = await supabase.from("drivers").select("*").limit(100);
        if (data) {
          await setToCache("drivers:client-list", data);
          await setToCache(`api:/api/drivers`, data);
        }
      } catch (error) {
        console.error("Error caching drivers:", error);
      }
    });
  }

  // Execute all cache operations in parallel
  await Promise.all(cacheOperations.map((op) => op()));
}
