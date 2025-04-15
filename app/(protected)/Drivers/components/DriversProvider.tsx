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

      // Only update state if this is an explicit refresh (updateLoadingState = true)
      if (updateLoadingState) {
        updateDriversState(result.data, source, result.timing);
      }

      // Update IndexedDB cache only if we have new data AND this is an explicit refresh
      if (updateLoadingState) {
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
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      if (channel) {
        await supabase.removeChannel(channel);
      }

      channel = supabase
        .channel("drivers_status_changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
          },
          async (payload: RealtimePostgresChangesPayload<Driver>) => {
            console.log("Real-time status update received:", payload);

            const newDriver = payload.new as Driver;
            const oldDriver = payload.old as Driver;

            if (!newDriver?.id) {
              console.error("Invalid payload received:", payload);
              return;
            }

            // Skip if this is our own optimistic update
            if (isOptimisticUpdate) {
              console.log("Skipping realtime update due to optimistic update");
              return;
            }

            // Apply the change directly without fetching all drivers
            setDrivers((currentDrivers) =>
              currentDrivers.map((driver) => {
                // Ensure both IDs are strings and trimmed for comparison
                const currentId = String(driver.id).trim();
                const newId = String(newDriver.id).trim();

                if (currentId === newId) {
                  // Apply all updates unconditionally
                  console.log(
                    `Updating driver ${driver.id} with new data:`,
                    newDriver
                  );
                  return { ...driver, ...newDriver };
                }
                return driver;
              })
            );

            // Update IndexedDB in the background
            try {
              const currentDrivers = await driversDB.getAllDrivers();
              if (!currentDrivers) return;

              const updatedDrivers = currentDrivers.map((driver) => {
                const currentId = String(driver.id).trim();
                const newId = String(newDriver.id).trim();

                return currentId === newId
                  ? { ...driver, ...newDriver }
                  : driver;
              });
              await driversDB.setDrivers(updatedDrivers);
            } catch (error) {
              console.error("Error updating IndexedDB:", error);
            }
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status:", status);
        });
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, [supabase, isOptimisticUpdate]);

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

          // Only fetch companies, skip background cache update
          fetchCompanies();
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
    refreshDrivers: fetchDrivers,
    clearCache,
    syncWithServer: fetchAndUpdateCache,
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
