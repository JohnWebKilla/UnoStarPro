"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "sonner";
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

interface ProgressUpdate {
  total: number;
  completed: number;
  message: string;
  type: "success" | "error" | "info";
  isVisible: boolean;
}

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
  processingDrivers: Record<string, boolean>;
  progressUpdate: ProgressUpdate;
  setProgressUpdate: (update: Partial<ProgressUpdate>) => void;
  refreshDrivers: (skipCache?: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  updateDrivers: (id: number, data: Partial<Driver>) => Promise<Driver>;
  updateDriverOptimistically: (
    driverId: string,
    updates: Partial<Driver>
  ) => void;
  setProcessingDriver: (driverId: string, processing: boolean) => void;
  setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
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
  const [processingDrivers, setProcessingDrivers] = useState<
    Record<string, boolean>
  >({});
  const [isOptimisticUpdate, setIsOptimisticUpdate] = useState(false);
  const [timingInfo, setTimingInfo] = useState<{
    total: number;
    database?: number;
    source?: string;
  } | null>(null);
  const [progressUpdate, setProgressUpdateState] = useState<ProgressUpdate>({
    total: 0,
    completed: 0,
    message: "",
    type: "info",
    isVisible: false,
  });
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
  const supabase = createClient();

  const setProgressUpdate = useCallback((update: Partial<ProgressUpdate>) => {
    setProgressUpdateState((current) => ({
      ...current,
      ...update,
    }));
  }, []);

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
        toast.error("Failed to load companies");
      }
    }
  };

  const fetchDrivers = useCallback(async (useCache = true) => {
    try {
      // Don't set loading state for cache-based fetches
      if (!useCache) setLoading(true);

      let data: Driver[] = [];
      if (useCache) {
        // Try to get from IndexedDB first
        try {
          data = await driversDB.getAllDrivers();
          if (data && data.length > 0) {
            setDrivers(data);
            // Fetch from server in background without loading state
            const serverData = await getDriversAction();
            if (JSON.stringify(serverData) !== JSON.stringify(data)) {
              setDrivers(serverData);
              await driversDB.setDrivers(serverData);
            }
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
      if (!useCache) setLoading(false);
    }
  }, []);

  // Enhanced real-time subscription setup
  const setupRealtimeSubscription = useCallback(async () => {
    const channel: RealtimeChannel = supabase
      .channel("drivers_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drivers",
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          console.log("Received real-time update:", payload);

          // Handle different types of changes
          switch (payload.eventType) {
            case "INSERT": {
              const newDriver = payload.new;
              // Fetch complete driver data including relations
              const { data: fullDriver } = await supabase
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
                .eq("id", newDriver.id)
                .single();

              if (fullDriver) {
                setDrivers((current) => [fullDriver, ...current]);
                // Update IndexedDB
                await driversDB.addDriver(fullDriver);
              }
              break;
            }
            case "UPDATE": {
              const updatedDriver = payload.new;
              // Fetch complete driver data including relations
              const { data: fullDriver } = await supabase
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
                .eq("id", updatedDriver.id)
                .single();

              if (fullDriver) {
                setDrivers((current) =>
                  current.map((d) => (d.id === fullDriver.id ? fullDriver : d))
                );
                // Update IndexedDB
                await driversDB.updateDriver(fullDriver);
              }
              break;
            }
            case "DELETE": {
              const deletedDriver = payload.old;
              setDrivers((current) =>
                current.filter((d) => d.id !== deletedDriver.id)
              );
              // Remove from IndexedDB
              await driversDB.deleteDriver(deletedDriver.id);
              // Show toast notification
              toast.error(
                `${deletedDriver.name || "Driver"} has been deleted.`
              );
              break;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Enhanced fetch and update function with time-based refresh control
  const fetchAndUpdateCache = async (
    updateLoadingState: boolean = true,
    force: boolean = false
  ) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;

    // Skip refresh if it's too soon and not forced
    if (!force && timeSinceLastFetch < REFRESH_THRESHOLD) {
      console.log("Skipping refresh - too soon since last fetch");
      return;
    }

    try {
      // Try to get from IndexedDB first
      const cachedData = await driversDB.getAllDrivers();
      if (cachedData && cachedData.length > 0) {
        setDrivers(cachedData);

        // Only show loading for forced refreshes
        if (force && updateLoadingState) setLoading(true);

        // Fetch from server in background
        const response = await getDriversAction();
        if (JSON.stringify(response) !== JSON.stringify(cachedData)) {
          setDrivers(response);
          await driversDB.setDrivers(response);
        }
      } else {
        // No cache available, show loading and fetch
        if (updateLoadingState) setLoading(true);
        const response = await getDriversAction();
        setDrivers(response);
        await driversDB.setDrivers(response);
      }

      setLastFetchTime(now);
    } catch (error) {
      console.error("Error fetching and updating cache:", error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced clear cache function
  const clearCache = async () => {
    try {
      // Clear server-side cache
      await clearDriverCaches();

      // Clear client-side caches
      await deleteClientCache("drivers:client-list");
      localStorage.removeItem("drivers:client-list");
      localStorage.removeItem("drivers:client-list:timestamp");

      // Clear IndexedDB
      await driversDB.clearDrivers();

      // Fetch fresh data
      await fetchAndUpdateCache();

      toast.success("Successfully cleared cache and refreshed data.");
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast.error("Failed to clear cache. Please try again.");
    }
  };

  // Set up initial data and subscriptions
  useEffect(() => {
    const setup = async () => {
      try {
        // Set up real-time subscription first
        const cleanup = await setupRealtimeSubscription();

        // Try to load from cache first
        const cachedData = await driversDB.getAllDrivers();
        if (cachedData && cachedData.length > 0) {
          setDrivers(cachedData);
          // Fetch fresh data in background without loading state
          const response = await getDriversAction();
          if (JSON.stringify(response) !== JSON.stringify(cachedData)) {
            setDrivers(response);
            await driversDB.setDrivers(response);
          }
        } else {
          // Only show loading if we need to fetch from server
          setLoading(true);
          await fetchAndUpdateCache(true, true);
        }

        // Set up focus event listener with debounce
        let focusTimeout: NodeJS.Timeout;
        const handleFocus = () => {
          clearTimeout(focusTimeout);
          focusTimeout = setTimeout(() => {
            // Never show loading state for focus events
            fetchAndUpdateCache(false, false);
          }, 1000);
        };

        window.addEventListener("focus", handleFocus);

        setLoading(false);

        return () => {
          cleanup();
          window.removeEventListener("focus", handleFocus);
          clearTimeout(focusTimeout);
        };
      } catch (error) {
        console.error("Error in setup:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        setLoading(false);
      }
    };

    setup();
  }, [setupRealtimeSubscription]);

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

  const updateDriverOptimistically = useCallback(
    (driverId: string, updates: Partial<Driver>) => {
      console.log(`Optimistically updating driver ${driverId} with:`, updates);

      // Set flag to ignore the next realtime update and reset it after a delay
      setIsOptimisticUpdate(true);
      setTimeout(() => {
        setIsOptimisticUpdate(false);
      }, 1000); // Reset after 1 second

      // Update local state
      setDrivers((currentDrivers) =>
        currentDrivers.map((driver) => {
          // Ensure both IDs are strings and trimmed for comparison
          const currentId = String(driver.id).trim();
          const targetId = String(driverId).trim();

          if (currentId === targetId) {
            const updatedDriver = { ...driver, ...updates };
            console.log(
              `Found driver ${driverId}, updating status from ${driver.status} to ${updates.status}`
            );
            return updatedDriver;
          }
          return driver;
        })
      );

      // Update IndexedDB immediately to persist the change
      driversDB
        .getAllDrivers()
        .then((currentDrivers) => {
          if (!currentDrivers) return;

          const updatedDrivers = currentDrivers.map((driver) => {
            // Use the same string comparison for IndexedDB update
            const currentId = String(driver.id).trim();
            const targetId = String(driverId).trim();

            return currentId === targetId ? { ...driver, ...updates } : driver;
          });
          return driversDB.setDrivers(updatedDrivers);
        })
        .catch((error) => {
          console.error("Error updating IndexedDB:", error);
        });
    },
    []
  );

  const setProcessingDriver = useCallback(
    (driverId: string, processing: boolean) => {
      setProcessingDrivers((current) => ({
        ...current,
        [driverId]: processing,
      }));
    },
    []
  );

  const contextValue: DriversContextType = {
    drivers,
    loading,
    error,
    dataSource,
    companies,
    timingInfo,
    processingDrivers,
    progressUpdate,
    setProgressUpdate,
    refreshDrivers: (skipCache?: boolean) =>
      fetchAndUpdateCache(true, skipCache),
    clearCache,
    syncWithServer: () => fetchAndUpdateCache(true, true),
    updateDrivers,
    updateDriverOptimistically,
    setProcessingDriver,
    setDrivers,
  };

  return (
    <DriversContext.Provider value={contextValue}>
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
