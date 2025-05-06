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
import { updateDriverAction, getDriverAction } from "../server-actions";
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
  selectedDriver: Driver | null;
  setSelectedDriver: (driver: Driver | null) => void;
  getDriverById: (id: string | number) => Driver | null;
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
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
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

        // Create a deep copy of the original driver to avoid reference issues
        const driverCopy = JSON.parse(JSON.stringify(oldDriver));

        // Always preserve these critical fields unless explicitly updated
        const criticalFields = [
          "company_id",
          "company_name",
          "companies",
          "documents",
          "driver_licenses",
          "medical_cards",
          "mvr_files",
          "subscription",
        ];

        // Create the updated driver object, preserving all original data
        const updatedDriver = {
          ...driverCopy, // Start with a complete copy of the original driver
          ...updates, // Apply the specific updates
        };

        // Double-check critical fields are preserved
        criticalFields.forEach((field) => {
          if (driverCopy[field] && !updates[field as keyof Partial<Driver>]) {
            updatedDriver[field as keyof Driver] =
              driverCopy[field as keyof Driver];
          }
        });

        // Set timestamp
        updatedDriver.updated_at =
          updates.updated_at || new Date().toISOString();

        // Replace the driver in the array
        updatedDrivers[driverIndex] = updatedDriver;

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

  // Function to get a driver by ID from the local state
  const getDriverById = useCallback(
    (id: string | number): Driver | null => {
      const driverId = typeof id === "string" ? id : String(id);
      return drivers.find((driver) => String(driver.id) === driverId) || null;
    },
    [drivers]
  );

  // Modified handleRowClick to set the selected driver before navigation
  const handleRowClick = useCallback(
    (driverId: string) => {
      const driver = getDriverById(driverId);
      if (driver) {
        setSelectedDriver(driver);
        // Store in sessionStorage to preserve across page navigations
        sessionStorage.setItem("selectedDriver", JSON.stringify(driver));
      }

      // Force hard navigation with window.location
      console.log("Row clicked, forcing hard navigation to driver:", driverId);

      // Add a small delay to ensure the session storage is set
      setTimeout(() => {
        window.location.href = `/Drivers/${driverId}`;
      }, 10);
    },
    [getDriverById]
  );

  // Load selected driver from sessionStorage on mount
  useEffect(() => {
    try {
      const storedDriver = sessionStorage.getItem("selectedDriver");
      if (storedDriver) {
        setSelectedDriver(JSON.parse(storedDriver));
      }
    } catch (error) {
      console.error("Error loading stored driver:", error);
    }
  }, []);

  const refreshDrivers = async (skipCache?: boolean) => {
    try {
      // Don't refresh if we've refreshed recently
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;
      if (timeSinceLastUpdate < 1000) {
        // Prevent refreshes more frequent than 1 second
        console.log("Skipping refresh, too soon since last update");
        return Promise.resolve();
      }

      setIsLoading(true);
      console.log("Refreshing drivers data from server");

      // Clear cache if skipCache is true
      if (skipCache) {
        await clearDriverCaches();
      }

      // Fetch fresh drivers data from the server
      try {
        const { data: freshData, error: fetchError } = await supabase
          .from("drivers")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) {
          console.error("Error fetching updated drivers data:", fetchError);
        } else if (freshData) {
          console.log(`Fetched ${freshData.length} drivers from server`);
          // Update the drivers state with fresh data
          setDrivers(freshData);
        }
      } catch (error) {
        console.error("Error during driver refresh:", error);
      }

      // Only refresh the page data if skipCache is true
      if (skipCache) {
        router.refresh();
      }

      // Also update the selected driver if we have one
      if (selectedDriver) {
        try {
          const freshDriver = await getDriverAction(Number(selectedDriver.id));
          if (freshDriver) {
            // Update selected driver with fresh data
            setSelectedDriver(freshDriver);

            // Also update session storage
            sessionStorage.setItem(
              "selectedDriver",
              JSON.stringify(freshDriver)
            );
          }
        } catch (error) {
          console.error("Failed to refresh selected driver:", error);
        }
      }

      setLastUpdateTime(now);
      return Promise.resolve();
    } catch (error) {
      console.error("Error refreshing drivers:", error);
      return Promise.reject(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Shared update function for realtime updates
  const updateFromRealtimeChange = useCallback(
    async (payload: any, event: "UPDATE" | "INSERT" | "DELETE") => {
      try {
        console.log(`Received ${event} event:`, payload);

        // Clear server-side cache
        await clearDriverCaches();

        // Fetch fresh data from server
        const { data: freshData, error: fetchError } = await supabase
          .from("drivers")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) {
          console.error(
            `Error fetching updated drivers after ${event}:`,
            fetchError
          );
          return;
        }

        if (freshData) {
          console.log(
            `Updating drivers state with fresh data (${freshData.length} items)`
          );

          // Create a completely new array to ensure React detects the state change
          const updatedDrivers = [...freshData];
          setDrivers(updatedDrivers);
          console.log(
            `Updated drivers data after ${event} event`,
            updatedDrivers
          );

          // For updates, also update the selectedDriver if it's the same one
          if (event === "UPDATE") {
            const updatedRecord = payload.new as Driver;

            // Check if this is the currently selected driver
            if (
              selectedDriver &&
              String(selectedDriver.id) === String(updatedRecord.id)
            ) {
              // Deep clone the record to force React to recognize it as a new value
              const freshDriverCopy = JSON.parse(JSON.stringify(updatedRecord));
              console.log(
                "Updating selected driver with real-time data",
                freshDriverCopy
              );

              // Update the selected driver with a new object reference
              setSelectedDriver(freshDriverCopy);

              // Update session storage too (no need to stringify twice)
              sessionStorage.setItem(
                "selectedDriver",
                JSON.stringify(freshDriverCopy)
              );
            }

            // Show notification
            const oldRecord = payload.old as Driver;
            const changedFields = getChangedFields(oldRecord, updatedRecord);

            if (changedFields.length > 0) {
              toast({
                title: "Driver Updated",
                description: `${updatedRecord.name}: Updated ${changedFields.join(", ")}.`,
              });
            } else {
              toast({
                title: "Driver Updated",
                description: `${updatedRecord.name} has been updated.`,
              });
            }
          }
          // For inserts, show appropriate notification
          else if (event === "INSERT") {
            const newRecord = payload.new as Driver;

            let details = [];
            if (newRecord.status) details.push(`Status: ${newRecord.status}`);
            if (newRecord.type) details.push(`Type: ${newRecord.type}`);
            if (newRecord.truckNumber)
              details.push(`Truck: ${newRecord.truckNumber}`);

            const detailsText =
              details.length > 0 ? ` (${details.join(", ")})` : "";

            toast({
              title: "New Driver Added",
              description: `${newRecord.name}${detailsText} has been added.`,
            });
          }
          // For deletes, check if we need to navigate away
          else if (event === "DELETE") {
            const oldRecord = payload.old as Driver;
            const deletedId = String(oldRecord.id);

            // If the deleted driver is the currently selected one, navigate back to list
            if (selectedDriver && String(selectedDriver.id) === deletedId) {
              toast({
                title: "Current Driver Deleted",
                description:
                  "The driver you're viewing has been deleted. Redirecting to drivers list.",
                variant: "destructive",
              });

              // Clear selected driver
              setSelectedDriver(null);
              sessionStorage.removeItem("selectedDriver");

              // Navigate back to drivers list after a brief delay
              setTimeout(() => {
                router.push("/Drivers");
              }, 1500);
            } else {
              // Just show notification
              let statusInfo = oldRecord.status ? ` (${oldRecord.status})` : "";

              toast({
                title: "Driver Removed",
                description: `${oldRecord.name}${statusInfo} has been removed from the system.`,
                variant: "destructive",
              });
            }
          }

          // Force router refresh to update server components
          router.refresh();

          // Force a re-render by updating last update time with a new Date object
          setLastUpdateTime(Date.now());

          // Explicitly update all drivers who need processing flags reset
          setProcessingDrivers({});

          console.log("Realtime update complete - UI should refresh now");
        }
      } catch (error) {
        console.error(`Error processing ${event} event:`, error);
      }
    },
    [
      selectedDriver,
      supabase,
      clearDriverCaches,
      toast,
      router,
      setProcessingDrivers,
    ]
  );

  // Set up real-time subscription
  useEffect(() => {
    console.log("Setting up drivers real-time subscription");
    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      // First, remove any existing channel
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
            console.log("⚡ Realtime update received:", payload);

            // Always refresh drivers on any change
            await refreshDrivers(false);

            // Log to verify refresh was triggered
            console.log("Refreshed drivers after realtime update");

            // The previous condition was too strict - it only refreshed on specific conditions
            // Now we'll refresh on any driver table change
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status:", status);
        });
    };

    setupRealtimeSubscription();

    return () => {
      console.log("Cleaning up drivers real-time subscription");
      if (channel) {
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, [supabase, refreshDrivers]);

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
    selectedDriver,
    setSelectedDriver,
    getDriverById,
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
