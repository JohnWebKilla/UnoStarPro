"use client";

import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";
import {
  getUsersAction,
  getUserAction,
  clearUserCachesAction,
} from "./server-actions";
import { User } from "../types/types";

// Define response type for cached data
export interface CacheResponse<T> {
  data: T;
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source: "client-cache" | "server" | "local-storage";
  };
}

// Get users with multi-layer caching
export async function getUsers(
  skipCache: boolean = false
): Promise<CacheResponse<User[]>> {
  const startTime = performance.now();

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      // Check localStorage first for the fastest possible retrieval
      const localData = localStorage.getItem("users:client-list");
      if (localData) {
        try {
          const parsedData = JSON.parse(localData);
          // Check if data is fresh (less than 5 minutes old)
          const timestamp = localStorage.getItem("users:client-list:timestamp");
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
      const result = await getClientCache<User[]>("users:client-list");
      if (result.data) {
        // Update localStorage for next time
        try {
          localStorage.setItem(
            "users:client-list",
            JSON.stringify(result.data)
          );
          localStorage.setItem(
            "users:client-list:timestamp",
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
  const users = await getUsersAction();

  // Try to cache the data on client-side
  try {
    // Cache in API
    await setClientCache("users:client-list", users);

    // Also cache in localStorage for faster retrieval next time
    try {
      localStorage.setItem("users:client-list", JSON.stringify(users));
      localStorage.setItem(
        "users:client-list:timestamp",
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
    data: users as User[],
    source: "database",
    timing: {
      total: endTime - startTime,
      database: endTime - dbStartTime,
      source: "server",
    },
  };
}

// Get a single user with multi-layer caching
export async function getUser(
  userId: string,
  skipCache: boolean = false
): Promise<CacheResponse<User | null>> {
  const startTime = performance.now();

  // Try to get from client cache if not skipping
  if (!skipCache) {
    try {
      // Check localStorage first for the fastest possible retrieval
      const localKey = `user:client-${userId}`;
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
      const result = await getClientCache<User>(`user:client-${userId}`);
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
  const user = await getUserAction(userId);

  // Try to cache the data on client-side
  if (user) {
    try {
      const localKey = `user:client-${userId}`;

      // Cache in API
      await setClientCache(localKey, user);

      // Also cache in localStorage for faster retrieval next time
      try {
        localStorage.setItem(localKey, JSON.stringify(user));
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
    data: user as User | null,
    source: "database",
    timing: {
      total: endTime - startTime,
      database: endTime - dbStartTime,
      source: "server",
    },
  };
}

// Clear all user caches (client and server)
export async function clearUserCaches(): Promise<boolean> {
  try {
    // Clear server-side caches
    const result = await clearUserCachesAction();

    // Clear client-side caches
    try {
      // Clear API cache
      await deleteClientCache("users:client-list");

      // Clear localStorage
      try {
        localStorage.removeItem("users:client-list");
        localStorage.removeItem("users:client-list:timestamp");

        // Clear any individual user caches
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("user:client-")) {
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}:timestamp`);
          }
        }
      } catch (e) {
        console.error("Error clearing localStorage:", e);
      }
    } catch (error) {
      console.error("Error clearing client caches:", error);
    }

    return result;
  } catch (error) {
    console.error("Error clearing user caches:", error);
    return false;
  }
}
