"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "@/components/ui/use-toast";
import { getDrivers, clearDriverCaches } from "../actions";
import { Driver, CacheResponse } from "../types";
import { deleteClientCache } from "@/utils/client-cache";
import { DRIVER_LIST_KEY } from "../redis-client";
import { useRouter } from "next/navigation";
import { driversDB } from "../lib/indexdb";
import { createClient } from "@/utils/supabase/client";
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { getDriversAction, updateDriverAction } from "../server-actions";

interface DriversContextType {
  drivers: Driver[];
  loading: boolean;
  error: Error | null;
  dataSource: string;
  companies: Array<{ id: number; name: string }>;
  timingInfo: {
    total: number;
    database?: number;
    source?: string;
  } | null;
  refreshDrivers: (skipCache?: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  updateDrivers: (id: number, data: Partial<Driver>) => Promise<Driver>;
}

const DriversContext = createContext<DriversContextType | undefined>(undefined);

export function DriversProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dataSource, setDataSource] = useState<string>("loading");
  const [companies, setCompanies] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    database?: number;
    source?: string;
  } | null>(null);
  const supabase = createClient();

  // Function to handle database cleanup in case of version mismatch
  const cleanupDatabase = async () => {
    try {
      // Delete the existing database
      await window.indexedDB.deleteDatabase("driversDB");
      console.log("Successfully deleted old database");

      // Reconnect to initialize with correct version
      await driversDB.connect();
      console.log("Successfully reconnected to database");
    } catch (error) {
      console.error("Error during database cleanup:", error);
    }
  };

  const updateDriversState = (
    newDrivers: Driver[],
    source: string,
    timing: any = null
  ) => {
    // Set the data first before changing loading state
    setDrivers(newDrivers);
    setDataSource(source);
    setTimingInfo(timing);
    // Use requestAnimationFrame to ensure UI updates before changing loading state
    requestAnimationFrame(() => {
      setLoading(false);
    });
  };

  const fetchCompanies = async () => {
    try {
      // First try to get companies from IndexedDB
      const cachedCompanies = await driversDB.getCompanies();
      if (cachedCompanies && cachedCompanies.length > 0) {
        setCompanies(cachedCompanies);
        return;
      }

      // If no cached data, fetch from API
      const response = await fetch("/api/companies");
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      const data = await response.json();
      setCompanies(data || []);

      // Cache the companies in IndexedDB
      await driversDB.setCompanies(data || []);
    } catch (error) {
      if (error instanceof Error && error.name === "VersionError") {
        await cleanupDatabase();
        // Retry fetching after cleanup
        await fetchCompanies();
      } else {
        console.error("Error fetching companies:", error);
        toast({
          title: "Error",
          description: "Failed to load companies",
          variant: "destructive",
        });
      }
    }
  };

  const fetchDrivers = useCallback(async (useCache = true) => {
    try {
      setLoading(true);
      setError(null);

      // If useCache is false, skip IndexedDB and fetch directly from server
      let data: Driver[] = [];
      if (useCache) {
        // Try to get from IndexedDB first
        try {
          data = await driversDB.getAllDrivers();
          if (data && data.length > 0) {
            setDrivers(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Error reading from IndexedDB:", e);
        }
      }

      // Fetch from server
      data = await getDriversAction();
      setDrivers(data);

      // Update IndexedDB
      try {
        await driversDB.setDrivers(data);
      } catch (e) {
        console.error("Error writing to IndexedDB:", e);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      console.error("Error fetching drivers:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAndUpdateCache = async (updateLoadingState: boolean = true) => {
    try {
      const result = await getDrivers(false);

      const source =
        result.source === "cache"
          ? result.timing.source === "client-cache"
            ? "Client Cache (API)"
            : result.timing.source === "local-storage"
              ? "Client Cache (Local)"
              : "Redis Cache"
          : "Database";

      // Only update loading state if this is not a background update
      if (updateLoadingState) {
        updateDriversState(result.data, source, result.timing);
      } else {
        // For background updates, only update if we have new data
        const hasChanges =
          JSON.stringify(result.data) !== JSON.stringify(drivers);
        if (hasChanges) {
          setDrivers(result.data);
          setDataSource(source);
          setTimingInfo(result.timing);
        }
      }

      // Update IndexedDB cache only if we have new data
      try {
        await driversDB.setDrivers(result.data);
      } catch (error) {
        if (error instanceof Error && error.name === "VersionError") {
          await cleanupDatabase();
          await driversDB.setDrivers(result.data);
        } else {
          console.error("Error updating IndexedDB cache:", error);
        }
      }
    } catch (error) {
      console.error("Error in fetchAndUpdateCache:", error);
    }
  };

  const clearCache = async () => {
    try {
      setLoading(true);
      // Clear all caches
      await clearDriverCaches();
      await driversDB.clearAll();

      toast({
        title: "Cache Cleared",
        description: "All caches have been cleared successfully.",
      });

      // Refresh drivers with skipCache=true to force a database fetch
      await fetchDrivers(true);
    } catch (error) {
      console.error("Error clearing cache:", error);
      setLoading(false);
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try again.",
        variant: "destructive",
      });
    }
  };

  const syncWithServer = useCallback(async () => {
    try {
      setLoading(true);
      // Force fetch from server
      const data = await getDriversAction();

      // Update state with fresh data
      setDrivers(data);

      // Update IndexedDB
      try {
        await driversDB.clearAll(); // Clear existing cache
        await driversDB.setDrivers(data);
      } catch (e) {
        console.error("Error updating IndexedDB:", e);
      }

      setDataSource("Database");
      setTimingInfo({
        total: 0,
        source: "server",
      });
    } catch (error) {
      console.error("Error syncing with server:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDrivers = useCallback(
    async (id: number, data: Partial<Driver>) => {
      try {
        // First update the server
        const updatedDriver = await updateDriverAction(id, data);

        // Then update local state
        setDrivers((prev) =>
          prev.map((driver) =>
            driver.id.toString() === id.toString()
              ? { ...driver, ...updatedDriver }
              : driver
          )
        );

        // Update IndexedDB
        try {
          const currentDrivers = await driversDB.getAllDrivers();
          const updatedDrivers = currentDrivers.map((driver) =>
            driver.id.toString() === id.toString()
              ? { ...driver, ...updatedDriver }
              : driver
          );
          await driversDB.setDrivers(updatedDrivers);
        } catch (e) {
          console.error("Error updating IndexedDB:", e);
        }

        // Return the updated driver for chaining
        return updatedDriver;
      } catch (error) {
        console.error("Error updating driver:", error);
        throw error; // Re-throw to be handled by the caller
      }
    },
    [updateDriverAction]
  );

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Try to load from cache first without setting loading state
        const cachedDrivers = await driversDB.getAllDrivers();
        if (cachedDrivers && cachedDrivers.length > 0) {
          // Immediately show cached data
          setDrivers(cachedDrivers);
          setDataSource("Local Cache");
          setTimingInfo({
            total: 0,
            source: "local-cache",
          });
          setLoading(false);

          // Fetch updates in the background without affecting the UI
          fetchCompanies();
          fetchAndUpdateCache(false);
          return;
        }

        // Only set loading if we don't have cached data
        setLoading(true);

        // If no cache, fetch fresh data
        fetchCompanies();
        fetchDrivers();
      } catch (error) {
        if (error instanceof Error && error.name === "VersionError") {
          await cleanupDatabase();
          // Retry with fresh data
          setLoading(true);
          fetchCompanies();
          fetchDrivers();
        } else {
          console.error("Error in loadInitialData:", error);
          setLoading(false);
          setError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // Unsubscribe from any existing subscription
      if (channel) {
        await supabase.removeChannel(channel);
      }

      channel = supabase
        .channel("drivers_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "drivers",
          },
          async (payload: RealtimePostgresChangesPayload<Driver>) => {
            console.log("Real-time update received:", payload);

            // Fetch fresh data immediately after any change
            try {
              const { data: freshData, error: fetchError } = await supabase
                .from("drivers")
                .select("*")
                .order("created_at", { ascending: false });

              if (fetchError) {
                console.error("Error fetching updated data:", fetchError);
                return;
              }

              if (freshData) {
                // Update state with fresh data
                setDrivers(freshData);
                // Update cache
                await driversDB.setDrivers(freshData);
                setDataSource("database");
                setTimingInfo({
                  total: 0,
                  source: "realtime-update",
                });
                console.log("Updated drivers data after real-time change");
              }
            } catch (error) {
              console.error("Error handling realtime update:", error);
            }
          }
        )
        .subscribe(
          (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR") => {
            console.log("Realtime subscription status:", status);
          }
        );
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, [supabase]);

  const value = {
    drivers,
    loading,
    error,
    dataSource,
    companies,
    timingInfo,
    refreshDrivers: fetchDrivers,
    clearCache,
    syncWithServer,
    updateDrivers,
  };

  return (
    <DriversContext.Provider value={value}>{children}</DriversContext.Provider>
  );
}

export function useDrivers() {
  const context = useContext(DriversContext);
  if (context === undefined) {
    throw new Error("useDrivers must be used within a DriversProvider");
  }
  return context;
}
