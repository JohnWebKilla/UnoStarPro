"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { toast } from "sonner";
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
  temporarilyDisableRealtimeInserts: () => void;
  markDriverAsDeleted: (driverId: string | number) => void;
}

const DriversContext = createContext<DriversContextType | undefined>(undefined);

interface DriversClientProviderProps {
  children: React.ReactNode;
  initialDrivers: Driver[];
}

// Helper function to group array items by a key
function groupBy<T extends Record<string, any>>(
  array: T[],
  key: string
): Record<string, T[]> {
  return array.reduce((result: Record<string, T[]>, item: T) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
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
  const router = useRouter();
  const [companies] = useState<Array<{ id: number; name: string }>>([]);
  const supabase = getRealTimeClient();
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const REFRESH_THRESHOLD = 5 * 60 * 1000; // Only refresh after 5 minutes of inactivity
  const [disableRealtimeInserts, setDisableRealtimeInserts] =
    useState<boolean>(false);
  const [deletedDriverIds, setDeletedDriverIds] = useState<Set<string>>(
    new Set()
  );

  const setProcessingDriver = useCallback((id: string, processing: boolean) => {
    setProcessingDrivers((prev) => ({ ...prev, [id]: processing }));
  }, []);

  const updateDriverOptimistically = useCallback(
    (id: string, updates: Partial<Driver>) => {
      console.log(`Optimistically updating driver ${id} with:`, {
        originalUpdates: updates,
        hasCompany: !!updates.company_name,
        hasLicenses: !!(
          updates.driver_licenses && updates.driver_licenses.length
        ),
      });

      setDrivers((prevDrivers) => {
        // Find the driver to update
        const driverIndex = prevDrivers.findIndex(
          (driver) => String(driver.id) === id
        );

        if (driverIndex === -1) {
          console.warn(`Driver with ID ${id} not found in local state`);
          return prevDrivers;
        }

        // Get the original driver
        const oldDriver = prevDrivers[driverIndex];

        // Create a deep copy of the original driver
        const driverCopy = JSON.parse(JSON.stringify(oldDriver));

        // Create a deep copy of the updates to avoid reference issues
        const updatesCopy = JSON.parse(JSON.stringify(updates));

        // CRITICAL: Special handling for nested objects that must be preserved
        const updatedDriver = {
          ...driverCopy, // Start with a deep copy of the original driver
          ...updatesCopy, // Apply the updates
        };

        // Explicitly preserve these critical fields (only if they exist in the updates)
        if (updatesCopy.company_name) {
          updatedDriver.company_name = updatesCopy.company_name;
        } else if (driverCopy.company_name) {
          updatedDriver.company_name = driverCopy.company_name;
        }

        // Preserve company object
        if (updatesCopy.companies) {
          updatedDriver.companies = updatesCopy.companies;
        } else if (driverCopy.companies) {
          updatedDriver.companies = driverCopy.companies;
        }

        // Preserve document arrays
        if (updatesCopy.driver_licenses) {
          updatedDriver.driver_licenses = updatesCopy.driver_licenses;
        } else if (driverCopy.driver_licenses) {
          updatedDriver.driver_licenses = driverCopy.driver_licenses;
        }

        if (updatesCopy.medical_cards) {
          updatedDriver.medical_cards = updatesCopy.medical_cards;
        } else if (driverCopy.medical_cards) {
          updatedDriver.medical_cards = driverCopy.medical_cards;
        }

        if (updatesCopy.mvr_files) {
          updatedDriver.mvr_files = updatesCopy.mvr_files;
        } else if (driverCopy.mvr_files) {
          updatedDriver.mvr_files = driverCopy.mvr_files;
        }

        // Set timestamp
        updatedDriver.updated_at =
          updatesCopy.updated_at || new Date().toISOString();

        // Log detailed info about the update
        console.log(`Driver ${id} update details:`, {
          hadCompanyBefore: !!driverCopy.company_name,
          hasCompanyAfter: !!updatedDriver.company_name,
          companyNameBefore: driverCopy.company_name,
          companyNameAfter: updatedDriver.company_name,
          hadLicensesBefore: !!(
            driverCopy.driver_licenses && driverCopy.driver_licenses.length
          ),
          hasLicensesAfter: !!(
            updatedDriver.driver_licenses &&
            updatedDriver.driver_licenses.length
          ),
          licenseCountBefore: driverCopy.driver_licenses?.length || 0,
          licenseCountAfter: updatedDriver.driver_licenses?.length || 0,
        });

        // Create a new array with the updated driver
        const updatedDrivers = [...prevDrivers];
        updatedDrivers[driverIndex] = updatedDriver;

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

      toast.success("Sync complete");
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)));
      toast.error("Sync failed");
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

      toast.success("Cache cleared");
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast.error("Failed to clear the cache. Please try again.");
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

  // Add this function to mark a driver as deleted
  const markDriverAsDeleted = useCallback((driverId: string | number) => {
    const driverIdStr = String(driverId);
    setDeletedDriverIds((prevIds) => {
      const newIds = new Set(prevIds);
      newIds.add(driverIdStr);

      // Store in localStorage for persistence across page refreshes
      try {
        const storedIds = JSON.parse(
          localStorage.getItem("deleted-driver-ids") || "[]"
        );
        if (!storedIds.includes(driverIdStr)) {
          localStorage.setItem(
            "deleted-driver-ids",
            JSON.stringify([...storedIds, driverIdStr])
          );
        }
      } catch (err) {
        console.error("Error updating deleted drivers in localStorage:", err);
      }

      return newIds;
    });

    // Also remove the driver from our local state immediately
    setDrivers((current) =>
      current.filter((d) => String(d.id) !== driverIdStr)
    );

    console.log(`Marked driver ${driverId} as permanently deleted`);
  }, []);

  // Load deleted driver IDs from localStorage on mount
  useEffect(() => {
    try {
      const storedIds = JSON.parse(
        localStorage.getItem("deleted-driver-ids") || "[]"
      );
      if (storedIds.length > 0) {
        setDeletedDriverIds(new Set(storedIds));
        console.log(`Loaded ${storedIds.length} known deleted driver IDs`);
      }
    } catch (err) {
      console.error("Error loading deleted driver IDs from localStorage:", err);
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

      // First, make sure we have the latest deleted drivers list from localStorage
      try {
        const storedIds = JSON.parse(
          localStorage.getItem("deleted-driver-ids") || "[]"
        );
        if (storedIds.length > 0) {
          // Update our state with any newly stored IDs
          setDeletedDriverIds(new Set(storedIds));
          console.log(
            `Refreshed deleted drivers list with ${storedIds.length} IDs`
          );
        }
      } catch (err) {
        console.error("Error refreshing deleted drivers list:", err);
      }

      // Keep a backup of current drivers to maintain company and doc data if needed
      const currentDrivers = [...drivers];

      // Map of driver IDs to their companies and doc data
      const driverDataMap = currentDrivers.reduce(
        (acc, driver) => {
          acc[String(driver.id)] = {
            company_name: driver.company_name,
            companies: driver.companies,
            driver_licenses: driver.driver_licenses || [],
            medical_cards: driver.medical_cards || [],
            mvr_files: driver.mvr_files || [],
          };
          return acc;
        },
        {} as Record<string, Partial<Driver>>
      );

      // Clear cache if skipCache is true
      if (skipCache) {
        console.log("Clearing server cache before refresh");
        await clearDriverCaches();
      }

      // Reload stored deleted IDs to ensure we have the most current list
      const storedDeletedIds = new Set(
        JSON.parse(localStorage.getItem("deleted-driver-ids") || "[]")
      );

      // Fetch fresh drivers data from the server including companies
      try {
        const { data: freshData, error: fetchError } = await supabase
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
          .order("created_at", { ascending: false });

        if (fetchError) {
          console.error("Error fetching updated drivers data:", fetchError);
        } else if (freshData && freshData.length > 0) {
          console.log(`Fetched ${freshData.length} drivers from server`);

          // First filter out any drivers that are in our deleted list
          // (do this early to avoid unnecessary processing)
          const filteredDrivers = freshData.filter((driver) => {
            const driverId = String(driver.id);
            const isDeleted =
              storedDeletedIds.has(driverId) || deletedDriverIds.has(driverId);
            if (isDeleted) {
              console.log(
                `Filtering out known deleted driver ${driverId} from fetched data`
              );
            }
            return !isDeleted;
          });

          console.log(
            `After filtering deleted drivers: ${filteredDrivers.length} of ${freshData.length} remaining`
          );

          // Extract driver IDs for batch document fetching
          const driverIds = filteredDrivers.map((driver) => driver.id);

          // Batch fetch all documents at once
          const [
            { data: allLicenses },
            { data: allMedicalCards },
            { data: allMvrRecords },
          ] = await Promise.all([
            supabase
              .from("driver_licenses")
              .select("*")
              .in("driver_id", driverIds),
            supabase
              .from("medical_cards")
              .select("*")
              .in("driver_id", driverIds),
            supabase.from("mvr_records").select("*").in("driver_id", driverIds),
          ]);

          // Group documents by driver_id for faster lookups
          const licensesByDriverId = groupBy(allLicenses || [], "driver_id");
          const medicalCardsByDriverId = groupBy(
            allMedicalCards || [],
            "driver_id"
          );
          const mvrRecordsByDriverId = groupBy(
            allMvrRecords || [],
            "driver_id"
          );

          // Complete driver objects with all data
          const completeDrivers = filteredDrivers.map((driver) => {
            const driverId = String(driver.id);

            // Ensure we have company name
            const companyName =
              driver.companies?.name ||
              driverDataMap[driverId]?.company_name ||
              "N/A";

            return {
              ...driver,
              company_name: companyName,
              driver_licenses:
                licensesByDriverId[driver.id] ||
                driverDataMap[driverId]?.driver_licenses ||
                [],
              medical_cards:
                medicalCardsByDriverId[driver.id] ||
                driverDataMap[driverId]?.medical_cards ||
                [],
              mvr_files:
                mvrRecordsByDriverId[driver.id] ||
                driverDataMap[driverId]?.mvr_files ||
                [],
            };
          });

          // Update the drivers state with complete drivers
          setDrivers(completeDrivers);
          console.log("Updated drivers with complete data", completeDrivers);
        }
      } catch (error) {
        console.error("Error during driver refresh:", error);
      }

      // Also update the selected driver if we have one
      if (selectedDriver) {
        try {
          const driverId = Number(selectedDriver.id);
          // Check if this driver was deleted
          if (
            storedDeletedIds.has(String(driverId)) ||
            deletedDriverIds.has(String(driverId))
          ) {
            console.log(
              `Selected driver ${driverId} was deleted, clearing selection`
            );
            setSelectedDriver(null);
            sessionStorage.removeItem("selectedDriver");
          } else {
            const freshDriver = await getDriverAction(driverId);
            if (freshDriver) {
              // Update selected driver with fresh data
              setSelectedDriver(freshDriver);

              // Also update session storage
              sessionStorage.setItem(
                "selectedDriver",
                JSON.stringify(freshDriver)
              );
            }
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

  // Update the shared update function for realtime updates
  const updateFromRealtimeChange = useCallback(
    async (payload: any, event: "UPDATE" | "INSERT" | "DELETE") => {
      try {
        console.log(`Received ${event} event:`, payload);

        // Always clear caches for all real-time events
        try {
          // Clear server-side cache via server action
          await clearDriverCaches();

          // Clear client-side localStorage cache
          try {
            if (
              payload.eventType === "UPDATE" ||
              payload.eventType === "DELETE"
            ) {
              const driverId =
                payload.eventType === "DELETE"
                  ? payload.old.id
                  : payload.new.id;

              // Clear individual driver cache
              localStorage.removeItem(`driver:client-${driverId}`);
              localStorage.removeItem(`driver:client-${driverId}:timestamp`);
            }

            // Always clear list cache for any driver change
            localStorage.removeItem("drivers:client-list");
            localStorage.removeItem("drivers:client-list:timestamp");

            console.log("✅ Client-side caches cleared for real-time update");
          } catch (localStorageError) {
            console.error(
              "Error clearing localStorage cache:",
              localStorageError
            );
          }
        } catch (cacheError) {
          console.error(
            "Failed to clear caches after real-time update:",
            cacheError
          );
        }

        // Special handling for DELETE events - directly remove from state
        if (event === "DELETE" && payload.old?.id) {
          const driverId = payload.old.id;
          console.log(`🗑️ Removing deleted driver ${driverId} from UI state`);

          // Mark as permanently deleted
          markDriverAsDeleted(driverId);

          // Force clear any caches specifically for this driver both in localStorage and in Redis
          try {
            // Local storage
            localStorage.removeItem(`driver:client-${driverId}`);
            localStorage.removeItem(`driver:client-${driverId}:timestamp`);
            localStorage.removeItem(`driver:created-by-form:${driverId}`);

            // Server-side Redis via our action
            await clearDriverCaches();
          } catch (err) {
            console.error(
              `Error clearing deleted driver ${driverId} caches:`,
              err
            );
          }

          // Show toast notification
          toast.error(`${payload.old?.name || "Driver"} has been deleted.`);
        }

        // Refresh drivers data
        await refreshDrivers(true);

        // Log to verify refresh was triggered
        console.log("Refreshed drivers after realtime update");

        // The previous condition was too strict - it only refreshed on specific conditions
        // Now we'll refresh on any driver table change
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
      refreshDrivers,
      markDriverAsDeleted,
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

            // Handle the event based on its type
            if (payload.eventType === "DELETE") {
              // Special handling for DELETE events
              console.log("🗑️ DELETE event detected, processing...", payload);

              // Get the driver ID
              const driverId = payload.old?.id;
              if (!driverId) {
                console.error("DELETE event missing driver ID in payload");
                return;
              }

              // Mark as permanently deleted in both state and localStorage
              markDriverAsDeleted(driverId);

              // Force clear any caches specifically for this driver
              try {
                // Clear localStorage caches
                localStorage.removeItem(`driver:client-${driverId}`);
                localStorage.removeItem(`driver:client-${driverId}:timestamp`);
                localStorage.removeItem(`driver:created-by-form:${driverId}`);

                // Clear list caches
                localStorage.removeItem("drivers:client-list");
                localStorage.removeItem("drivers:client-list:timestamp");

                // Server-side cache clearing
                await clearDriverCaches();

                // Force update UI by removing this driver from state
                setDrivers((currentDrivers) =>
                  currentDrivers.filter(
                    (driver) => String(driver.id) !== String(driverId)
                  )
                );

                // If this was the selected driver, clear selection
                if (
                  selectedDriver &&
                  String(selectedDriver.id) === String(driverId)
                ) {
                  setSelectedDriver(null);
                  sessionStorage.removeItem("selectedDriver");
                }

                console.log(
                  `✅ Successfully processed DELETE event for driver ${driverId}`
                );
              } catch (err) {
                console.error(
                  `Error processing DELETE event for driver ${driverId}:`,
                  err
                );
              }

              // Show toast notification
              toast.error(`${payload.old?.name || "Driver"} has been deleted.`);

              return; // Skip the rest of the processing
            }

            // Handle INSERT and UPDATE events with the standard flow
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              // Skip processing if this is an INSERT and our list of deleted drivers includes this ID
              // (this can happen if the DB still has the driver but we've locally marked it as deleted)
              if (payload.eventType === "INSERT" && payload.new?.id) {
                const driverId = String(payload.new.id);
                const storedDeletedIds = new Set(
                  JSON.parse(localStorage.getItem("deleted-driver-ids") || "[]")
                );

                if (
                  storedDeletedIds.has(driverId) ||
                  deletedDriverIds.has(driverId)
                ) {
                  console.log(
                    `🛑 Ignoring INSERT event for previously deleted driver ${driverId}`
                  );
                  return;
                }
              }

              // Always clear caches for all real-time events
              try {
                // Clear server-side cache via server action
                await clearDriverCaches();

                // Clear client-side localStorage cache
                try {
                  if (payload.eventType === "UPDATE") {
                    const driverId = payload.new.id;

                    // Clear individual driver cache
                    localStorage.removeItem(`driver:client-${driverId}`);
                    localStorage.removeItem(
                      `driver:client-${driverId}:timestamp`
                    );
                  }

                  // Always clear list cache for any driver change
                  localStorage.removeItem("drivers:client-list");
                  localStorage.removeItem("drivers:client-list:timestamp");

                  console.log(
                    "✅ Client-side caches cleared for real-time update"
                  );
                } catch (localStorageError) {
                  console.error(
                    "Error clearing localStorage cache:",
                    localStorageError
                  );
                }
              } catch (cacheError) {
                console.error(
                  "Failed to clear caches after real-time update:",
                  cacheError
                );
              }

              // Refresh drivers data
              await refreshDrivers(true);

              // Log to verify refresh was triggered
              console.log("Refreshed drivers after realtime update");
            }
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
  }, [
    supabase,
    refreshDrivers,
    markDriverAsDeleted,
    clearDriverCaches,
    selectedDriver,
  ]);

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

  const temporarilyDisableRealtimeInserts = useCallback(() => {
    console.log("🛑 Temporarily disabling real-time INSERT handling");
    setDisableRealtimeInserts(true);

    // Re-enable after 5 seconds
    setTimeout(() => {
      console.log("✅ Re-enabling real-time INSERT handling");
      setDisableRealtimeInserts(false);
    }, 5000);
  }, []);

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
    temporarilyDisableRealtimeInserts,
    markDriverAsDeleted,
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
