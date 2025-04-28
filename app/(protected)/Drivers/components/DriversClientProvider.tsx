"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import { Driver, RealtimePayload } from "../types";
import { useRouter } from "next/navigation";
import { clearDriverCaches } from "../actions";
import { updateDriverAction } from "../server-actions";
import { getRealTimeClient } from "@/utils/supabase/client";
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

interface DriversContextType {
  drivers: Driver[];
  error: Error | null;
  isLoading: boolean;
  isSyncing: boolean;
  syncWithServer: () => Promise<void>;
  clearCache: () => Promise<void>;
  updateDriverOptimistically: (id: string, updates: Partial<Driver>) => void;
  processingDrivers: Record<string, boolean>;
  setProcessingDriver: (id: string, processing: boolean) => void;
  showImportDialog: boolean;
  setShowImportDialog: (show: boolean) => void;
  handleRowClick: (driverId: string) => void;
  refreshDrivers: (skipCache?: boolean) => Promise<void>;
  companies: Array<{ id: number; name: string }>;
}

const DriversContext = createContext<DriversContextType | undefined>(undefined);

interface DriversClientProviderProps {
  children: React.ReactNode;
  initialDrivers: Driver[];
}

function getChangedFields(oldRecord: any, newRecord: any): string[] {
  if (!oldRecord || !newRecord) return [];

  const changedFields: string[] = [];
  const keyMappings: Record<string, string> = {
    name: "Name",
    phone: "Phone",
    truckNumber: "Truck Number",
    type: "Driver Type",
    status: "Status",
    active: "Active Status",
    company_id: "Company",
    hire_date: "Hire Date",
    terminated_date: "Termination Date",
    subscription_amount: "Subscription Amount",
    price_amount: "Price Amount",
  };

  // Check common fields that we care about showing in notifications
  for (const key of Object.keys(keyMappings)) {
    if (
      oldRecord[key] !== newRecord[key] &&
      oldRecord[key] !== undefined &&
      newRecord[key] !== undefined
    ) {
      changedFields.push(keyMappings[key]);
    }
  }

  return changedFields;
}

export function DriversClientProvider({
  children,
  initialDrivers,
}: DriversClientProviderProps) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [processingDrivers, setProcessingDrivers] = useState<
    Record<string, boolean>
  >({});
  const [showImportDialog, setShowImportDialog] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [companies] = useState<Array<{ id: number; name: string }>>([]);
  const supabase = getRealTimeClient();
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const REFRESH_THRESHOLD = 5 * 60 * 1000; // Only refresh after 5 minutes of inactivity

  const setProcessingDriver = useCallback((id: string, processing: boolean) => {
    setProcessingDrivers((prev) => ({ ...prev, [id]: processing }));
  }, []);

  const updateDriverOptimistically = useCallback(
    (id: string, updates: Partial<Driver>) => {
      console.log(`Optimistically updating driver ${id} with:`, updates);

      setDrivers((prevDrivers) => {
        // Find the driver to update
        const driverIndex = prevDrivers.findIndex(
          (driver) => String(driver.id) === id
        );

        if (driverIndex === -1) {
          console.warn(`Driver with ID ${id} not found in local state`);
          return prevDrivers;
        }

        // Create a new array with the updated driver
        const updatedDrivers = [...prevDrivers];
        const oldDriver = updatedDrivers[driverIndex];

        // If updates is a complete driver object (from server), use it directly
        // Otherwise, merge with existing driver data
        const isFullUpdate = updates.id && updates.name && updates.created_at;

        updatedDrivers[driverIndex] = isFullUpdate
          ? { ...(updates as Driver) }
          : { ...oldDriver, ...updates, updated_at: new Date().toISOString() };

        console.log(
          `Driver ${id} updated in local state:`,
          updatedDrivers[driverIndex]
        );
        return updatedDrivers;
      });
    },
    []
  );

  const syncWithServer = async () => {
    try {
      setIsSyncing(true);
      setIsLoading(true);

      // Force revalidation to get fresh data from the server
      router.refresh();

      toast({
        title: "Sync complete",
        description: "Successfully synchronized with server.",
      });
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)));
      toast({
        title: "Sync failed",
        description: "Failed to synchronize with server.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      // Clear server-side cache only
      await clearDriverCaches();

      // Force revalidation to get fresh data
      router.refresh();

      toast({
        title: "Cache cleared",
        description:
          "Cache has been cleared and data refreshed from the server.",
      });
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear the cache. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRowClick = (driverId: string) => {
    router.push(`/Drivers/${driverId}`);
  };

  const refreshDrivers = async (skipCache?: boolean) => {
    try {
      setIsLoading(true);
      router.refresh();
      setLastUpdateTime(Date.now());
      return Promise.resolve();
    } catch (error) {
      console.error("Error refreshing drivers:", error);
      return Promise.reject(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time subscription directly in the provider
  useEffect(() => {
    console.log("Setting up drivers real-time subscription directly");
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // Unsubscribe from any existing subscription
      if (channel) {
        await supabase.removeChannel(channel);
      }

      // Clear any existing cache when setting up the subscription
      try {
        await clearDriverCaches();
        console.log(
          "Cleared driver caches when setting up real-time subscription"
        );
      } catch (error) {
        console.error("Error clearing cache during subscription setup:", error);
      }

      const channelName = `drivers_changes_${Date.now()}`;
      console.log("Creating new realtime channel:", channelName);

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
          },
          async (payload: RealtimePostgresChangesPayload<any>) => {
            console.log("Received UPDATE event:", payload);
            try {
              // Clear server-side cache to ensure fresh data
              await clearDriverCaches();

              // Fetch fresh data from the server instead of just updating the local state
              const { data: freshData, error: fetchError } = await supabase
                .from("drivers")
                .select("*")
                .order("created_at", { ascending: false });

              if (fetchError) {
                console.error("Error fetching updated drivers:", fetchError);
                return;
              }

              if (freshData) {
                setDrivers(freshData);
                console.log("Updated drivers data after real-time change");

                // Show detailed update information
                const newRecord = payload.new as Driver;
                const oldRecord = payload.old as Driver;

                const changedFields = getChangedFields(oldRecord, newRecord);

                if (changedFields.length > 0) {
                  toast({
                    title: "Driver Updated",
                    description: `${newRecord.name}: Updated ${changedFields.join(", ")}.`,
                  });
                } else {
                  toast({
                    title: "Driver Updated",
                    description: `${newRecord.name} has been updated.`,
                  });
                }

                // Force router refresh to update any server components
                router.refresh();
                setLastUpdateTime(Date.now());
              }
            } catch (error) {
              console.error("Error processing UPDATE event:", error);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "drivers",
          },
          async (payload: RealtimePostgresChangesPayload<any>) => {
            console.log("Received INSERT event:", payload);
            try {
              // Clear server-side cache to ensure fresh data
              await clearDriverCaches();

              // Fetch fresh data from the server
              const { data: freshData, error: fetchError } = await supabase
                .from("drivers")
                .select("*")
                .order("created_at", { ascending: false });

              if (fetchError) {
                console.error("Error fetching updated drivers:", fetchError);
                return;
              }

              if (freshData) {
                setDrivers(freshData);
                console.log("Updated drivers data after real-time change");

                // Show detailed new driver information
                const newRecord = payload.new as Driver;

                let details = [];
                if (newRecord.status)
                  details.push(`Status: ${newRecord.status}`);
                if (newRecord.type) details.push(`Type: ${newRecord.type}`);
                if (newRecord.truckNumber)
                  details.push(`Truck: ${newRecord.truckNumber}`);

                const detailsText =
                  details.length > 0 ? ` (${details.join(", ")})` : "";

                toast({
                  title: "New Driver Added",
                  description: `${newRecord.name}${detailsText} has been added.`,
                });

                // Force router refresh to update any server components
                router.refresh();
                setLastUpdateTime(Date.now());
              }
            } catch (error) {
              console.error("Error processing INSERT event:", error);
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "drivers",
          },
          async (payload: RealtimePostgresChangesPayload<any>) => {
            console.log("Received DELETE event:", payload);
            try {
              // Clear server-side cache to ensure fresh data
              await clearDriverCaches();

              // Fetch fresh data from the server
              const { data: freshData, error: fetchError } = await supabase
                .from("drivers")
                .select("*")
                .order("created_at", { ascending: false });

              if (fetchError) {
                console.error("Error fetching updated drivers:", fetchError);
                return;
              }

              if (freshData) {
                setDrivers(freshData);
                console.log("Updated drivers data after real-time change");

                // Show detailed driver removal information
                const oldRecord = payload.old as Driver;
                let statusInfo = "";

                if (oldRecord.status) {
                  statusInfo = ` (${oldRecord.status})`;
                }

                toast({
                  title: "Driver Removed",
                  description: `${oldRecord.name}${statusInfo} has been removed from the system.`,
                  variant: "destructive", // Use destructive variant for deletions
                });

                // Force router refresh to update any server components
                router.refresh();
                setLastUpdateTime(Date.now());
              }
            } catch (error) {
              console.error("Error processing DELETE event:", error);
            }
          }
        )
        .subscribe((status, err) => {
          console.log("Realtime subscription status:", status);
          if (err) {
            console.error("Realtime subscription error:", err);
          } else {
            console.log("Successfully subscribed to drivers table changes");
          }
        });
    };

    setupRealtimeSubscription();

    return () => {
      console.log("Cleaning up drivers real-time subscription");
      if (channel) {
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, [supabase, toast]);

  // Add a visibility change handler to avoid unnecessary refreshes
  useEffect(() => {
    let lastVisibilityChange = Date.now();

    const handleVisibilityChange = async () => {
      // Only refresh data when the page becomes visible and it's been a while since our last update
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime;
        const timeSinceLastVisibilityChange = now - lastVisibilityChange;

        // Only refresh if it's been a significant time (5 minutes) and not just a quick tab switch
        if (
          timeSinceLastUpdate > REFRESH_THRESHOLD &&
          timeSinceLastVisibilityChange > 1000
        ) {
          console.log(
            "Refreshing drivers after tab focus due to long inactivity:",
            {
              timeSinceLastUpdate: Math.floor(timeSinceLastUpdate / 1000) + "s",
              threshold: Math.floor(REFRESH_THRESHOLD / 1000) + "s",
            }
          );

          await refreshDrivers(false);
          setLastUpdateTime(now);
        } else {
          console.log("Skipping refresh on tab focus, data is still fresh", {
            timeSinceLastUpdate: Math.floor(timeSinceLastUpdate / 1000) + "s",
            threshold: Math.floor(REFRESH_THRESHOLD / 1000) + "s",
          });
        }
      }

      lastVisibilityChange = Date.now();
    };

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshDrivers, lastUpdateTime]);

  const value: DriversContextType = {
    drivers,
    error,
    isLoading,
    isSyncing,
    syncWithServer,
    clearCache,
    updateDriverOptimistically,
    processingDrivers,
    setProcessingDriver,
    showImportDialog,
    setShowImportDialog,
    handleRowClick,
    refreshDrivers,
    companies,
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
