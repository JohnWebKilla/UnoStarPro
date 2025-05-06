"use client";

import { Row, RowSelectionState, OnChangeFn } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Driver } from "../types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useDrivers } from "./DriversClientProvider";
import { usePathname } from "next/navigation";
import { updateDriverStatusBatchAction } from "../server-actions";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DriversDataTableProps {
  data: Driver[];
}

export function DriversDataTable({ data: initialData }: DriversDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    drivers: contextDrivers,
    setSelectedDriver,
    refreshDrivers,
  } = useDrivers();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isPrefetched, setIsPrefetched] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Use the data from context if available, otherwise use initialData
  const [tableData, setTableData] = useState<Driver[]>(initialData);

  // Update tableData when contextDrivers changes
  useEffect(() => {
    if (contextDrivers && contextDrivers.length > 0) {
      console.log(
        "Updating table data from context with",
        contextDrivers.length,
        "drivers"
      );
      setTableData(contextDrivers);
    }
  }, [contextDrivers]);

  // Log when data changes for debugging
  useEffect(() => {
    console.log(
      "DriversDataTable rendering with data length:",
      tableData.length,
      "context length:",
      contextDrivers.length
    );
  }, [tableData, contextDrivers]);

  // Get unique companies from drivers
  const companies = useMemo(() => {
    const uniqueCompanies = new Set<string>();
    tableData?.forEach((driver) => {
      if (driver.company_name) {
        uniqueCompanies.add(driver.company_name);
      }
    });
    return Array.from(uniqueCompanies).sort();
  }, [tableData]);

  // Filter data based on status and company
  const filteredData = useMemo(() => {
    return tableData;
  }, [tableData]);

  // Helper function to update multiple drivers optimistically
  const updateDriversOptimistically = (
    driverIds: number[],
    updates: Partial<Driver>
  ) => {
    setSelectedDriver(driverIds, updates);
  };

  // Helper function to refresh data after updates
  const refreshData = useCallback(async () => {
    try {
      // Force a router refresh to clear Next.js cache
      router.refresh();
      // Refresh drivers data with skipCache=true
      await refreshDrivers(true);
    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  }, [router, refreshDrivers]);

  // Handle activating selected drivers
  const handleActivateSelected = async (ids: number[]) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Apply optimistic update
      updateDriversOptimistically(ids, { status: "active" });

      const result = await updateDriverStatusBatchAction(ids, "active");

      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully activated ${ids.length} driver(s)`,
        });

        // Update with actual server response data
        if (result.updatedDrivers) {
          // Create a map for quick lookups
          const updatedDriversMap = new Map(
            result.updatedDrivers.map((d) => [String(d.id), d])
          );

          // Update the table data
          updateDriversOptimistically(ids, (prevDriver) => ({
            ...prevDriver,
            ...updatedDriversMap.get(String(d.id)),
          }));

          // Refresh data to ensure consistency
          await refreshData();
        }
      } else {
        // Revert optimistic update on error
        updateDriversOptimistically(ids, { status: "inactive" });

        toast({
          title: "Error",
          description: result.error || "Failed to activate drivers",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Revert optimistic update on error
      updateDriversOptimistically(ids, { status: "inactive" });

      console.error("Error activating drivers:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while activating drivers",
        variant: "destructive",
      });
    } finally {
      setRowSelection({});
      setIsProcessing(false);
    }
  };

  // Handle deactivating selected drivers
  const handleDeactivateSelected = async (ids: number[]) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Apply optimistic update
      updateDriversOptimistically(ids, { status: "inactive" });

      const result = await updateDriverStatusBatchAction(ids, "inactive");

      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully deactivated ${ids.length} driver(s)`,
        });

        // Update with actual server response data
        if (result.updatedDrivers) {
          // Create a map for quick lookups
          const updatedDriversMap = new Map(
            result.updatedDrivers.map((d) => [String(d.id), d])
          );

          // Update the table data
          updateDriversOptimistically(ids, (prevDriver) => ({
            ...prevDriver,
            ...updatedDriversMap.get(String(d.id)),
          }));

          // Refresh data to ensure consistency
          await refreshData();
        }
      } else {
        // Revert optimistic update on error
        updateDriversOptimistically(ids, { status: "active" });

        toast({
          title: "Error",
          description: result.error || "Failed to deactivate drivers",
          variant: "destructive",
        });
      }
    } catch (error) {
      // Revert optimistic update on error
      updateDriversOptimistically(ids, { status: "active" });

      console.error("Error deactivating drivers:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deactivating drivers",
        variant: "destructive",
      });
    } finally {
      setRowSelection({});
      setIsProcessing(false);
    }
  };

  // Set up navigation callbacks for better performance
  const navigateToDriver = useCallback(
    (driverId: string, driver: Driver) => {
      // Store data for instant access first - do this BEFORE navigation
      setSelectedDriver(driver);
      sessionStorage.setItem("selectedDriver", JSON.stringify(driver));

      // Force a hard navigation with window.location
      const url = `/Drivers/${driverId}`;
      console.log("Forcing hard navigation to driver details:", url);

      // Add a small delay to ensure the session storage is set
      setTimeout(() => {
        window.location.href = url;
      }, 10);
    },
    [setSelectedDriver]
  );

  // Eager prefetch all driver detail routes
  useEffect(() => {
    const prefetchDrivers = async () => {
      // First, prefetch the actual detail routes
      await Promise.all(
        tableData.map(async (driver) => {
          if (driver.id && !isPrefetched[String(driver.id)]) {
            try {
              // Prefetch the page - this helps NextJS prepare the route
              await router.prefetch(`/Drivers/${driver.id}`);
              setIsPrefetched((prev) => ({
                ...prev,
                [String(driver.id)]: true,
              }));
            } catch (error) {
              console.error(`Failed to prefetch driver ${driver.id}:`, error);
            }
          }
        })
      );
    };

    prefetchDrivers();
  }, [tableData, router, isPrefetched]);

  // Handle row selection change
  const handleRowSelectionChange = useCallback((updater: any) => {
    setRowSelection(updater);
  }, []);

  // Create a row double-click handler with instant feedback
  const handleRowDoubleClick = useCallback(
    (row: Row<Driver>) => {
      const driverId = row?.original?.id;
      if (!driverId) {
        console.warn("Row double-clicked but no driver ID found", row);
        return;
      }

      navigateToDriver(String(driverId), row.original);
    },
    [navigateToDriver]
  );

  // Single click handler for the "View Details" action
  const handleViewDetails = useCallback(
    (driver: Driver) => {
      if (!driver.id) return;
      navigateToDriver(String(driver.id), driver);
    },
    [navigateToDriver]
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={filteredData}
        onRowDoubleClick={(row) => {
          const driverId = row.original.id;
          navigateToDriver(driverId, row.original);
        }}
        onActivateSelected={handleActivateSelected}
        onDeactivateSelected={handleDeactivateSelected}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection as OnChangeFn<RowSelectionState>}
        isProcessing={isProcessing}
      />
    </div>
  );
}
