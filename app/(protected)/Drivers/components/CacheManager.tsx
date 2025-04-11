"use client";

import { useEffect } from "react";
import { driversDB } from "../lib/indexdb";

export function useCacheManager() {
  useEffect(() => {
    // Listen for custom event to clear IndexedDB cache
    const handleClearCache = async () => {
      try {
        await driversDB.clearAll();
        console.log("Cleared IndexedDB cache");
      } catch (error) {
        console.error("Failed to clear IndexedDB cache:", error);
      }
    };

    // Add event listener
    window.addEventListener("clear-drivers-cache", handleClearCache);

    // Cleanup
    return () => {
      window.removeEventListener("clear-drivers-cache", handleClearCache);
    };
  }, []);

  return null;
}

export function CacheManager() {
  useCacheManager();
  return null;
}
