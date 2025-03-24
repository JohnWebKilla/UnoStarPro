"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { getDrivers, clearDriverCaches } from "../actions";
import { Driver, CacheResponse } from "../types";
import { deleteClientCache } from "@/utils/client-cache";
import { DRIVER_LIST_KEY } from "../redis-client";

interface DriversContextType {
  drivers: Driver[];
  loading: boolean;
  error: string | null;
  dataSource: string;
  companies: Array<{ id: number; name: string }>;
  timingInfo: {
    total: number;
    database?: number;
    source?: string;
  } | null;
  refreshDrivers: (skipCache?: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
}

const DriversContext = createContext<DriversContextType | undefined>(undefined);

export function DriversProvider({ children }: { children: React.ReactNode }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("loading");
  const [companies, setCompanies] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    database?: number;
    source?: string;
  } | null>(null);

  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/companies");
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      const data = await response.json();
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    }
  };

  const fetchDrivers = async (skipCache: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      setDataSource("loading");

      // If skipCache is true, clear all caches first
      if (skipCache) {
        await clearDriverCaches();
      }

      // Use the new action with Redis cache
      const result = await getDrivers(skipCache);

      setDrivers(result.data);
      setDataSource(
        result.source === "cache"
          ? result.timing.source === "client-cache"
            ? "Client Cache"
            : "Redis Cache"
          : "Database"
      );
      setTimingInfo(result.timing);
    } catch (err) {
      console.error("Error fetching drivers:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      setDataSource("error");

      if (
        errorMessage.includes("401") ||
        errorMessage.includes("Unauthorized")
      ) {
        toast({
          title: "Authentication Error",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        // Redirect to login page
        window.location.href = "/login";
      } else {
        toast({
          title: "Error",
          description: "Failed to load drivers. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      // Clear both client and server caches
      await clearDriverCaches();

      toast({
        title: "Cache Cleared",
        description: "Driver cache has been cleared successfully.",
      });

      // Refresh drivers with skipCache=true to force a database fetch
      await fetchDrivers(true);
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchDrivers();
  }, []);

  return (
    <DriversContext.Provider
      value={{
        drivers,
        loading,
        error,
        dataSource,
        companies,
        timingInfo,
        refreshDrivers: fetchDrivers,
        clearCache,
      }}
    >
      {children}
    </DriversContext.Provider>
  );
}

export function useDrivers() {
  const context = useContext(DriversContext);
  if (context === undefined) {
    throw new Error("useDrivers must be used within a DriversProvider");
  }
  return context;
}
