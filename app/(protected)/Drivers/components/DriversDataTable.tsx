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
  // Track the currently selected driver (by row click, not checkbox)
  const [selectedDriverRow, setSelectedDriverRow] = useState<Driver | null>(
    null
  );
  // Add missing state variables
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<
    Record<string, Driver>
  >({});

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

  // Helper function to update multiple drivers optimistically
  const updateDriversOptimistically = (
    driverIds: number[],
    updates: Partial<Driver>
  ) => {
    // Update each driver with the provided updates
    driverIds.forEach((id) => {
      // Find the driver in tableData
      const driver = tableData.find((d) => Number(d.id) === id);
      if (driver) {
        // Create the updated driver - ensure we preserve ALL existing data
        const updatedDriver = {
          ...driver, // Keep all original properties
          ...updates, // Apply only the specific updates
          // Make sure to explicitly preserve these critical fields
          company_id: driver.company_id,
          company_name: driver.company_name,
          companies: driver.companies,
          documents: driver.documents,
        };
        // Call setSelectedDriver with the updated driver
        setSelectedDriver(updatedDriver);

        // Also update the table data directly for immediate UI update
        setTableData((prevData) =>
          prevData.map((d) => (Number(d.id) === id ? updatedDriver : d))
        );
      }
    });
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

  // Helper function to preserve all properties when updating a driver
  const preserveDriverData = (
    driver: Driver,
    updates: Partial<Driver>
  ): Driver => {
    // Create a complete copy of the driver
    const driverCopy = JSON.parse(JSON.stringify(driver));
    // Apply only the specified updates
    return {
      ...driverCopy,
      ...updates,
    };
  };

  // Handle activating selected drivers
  const handleActivateSelected = async () => {
    try {
      const ids = getSelectedDriverIds();
      if (isProcessing || ids.length === 0) return;

      setIsProcessing(true);

      // Log the operation and driver data before action
      console.log(`Activating ${ids.length} drivers`, ids);
      console.log("Current table data before activation:", tableData);

      // Call the server action
      const result = await updateDriverStatusBatchAction(ids, "active");

      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully activated ${ids.length} driver(s)`,
        });

        // If server returned complete updated drivers, use them
        if (result.updatedDrivers && result.updatedDrivers.length > 0) {
          console.log(
            "Server returned complete drivers:",
            result.updatedDrivers
          );

          // Update the local data with complete drivers from server
          setTableData((prevData) => {
            const newData = prevData.map((driver) => {
              const serverUpdated = result.updatedDrivers?.find(
                (d) => String(d.id) === String(driver.id)
              );
              // Log each driver update
              if (serverUpdated) {
                console.log(`Updating driver ${driver.id}:`, {
                  previousCompany: driver.company_name,
                  newCompany: serverUpdated.company_name,
                  previousDocs: driver.driver_licenses?.length || 0,
                  newDocs: serverUpdated.driver_licenses?.length || 0,
                });
              }
              return serverUpdated || driver;
            });

            console.log("Updated table data after activation:", newData);
            return newData;
          });
        }

        // Reset selection
        setRowSelection({});
        setSelectedDriverRow(null);
      } else {
        console.error("Failed to activate drivers:", result.error);
        toast({
          title: "Error",
          description: `Failed to activate drivers: ${result.error}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error activating drivers:", error);
      toast({
        title: "Error",
        description: "Failed to activate drivers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle deactivating selected drivers
  const handleDeactivateSelected = async () => {
    try {
      const ids = getSelectedDriverIds();
      if (isProcessing || ids.length === 0) return;

      setIsProcessing(true);

      // Log the operation and driver data before action
      console.log(`Deactivating ${ids.length} drivers`, ids);
      console.log("Current table data before deactivation:", tableData);

      // Call the server action
      const result = await updateDriverStatusBatchAction(ids, "inactive");

      if (result.success) {
        toast({
          title: "Success",
          description: `Successfully deactivated ${ids.length} driver(s)`,
        });

        // If server returned complete updated drivers, use them
        if (result.updatedDrivers && result.updatedDrivers.length > 0) {
          console.log(
            "Server returned complete drivers:",
            result.updatedDrivers
          );

          // Update the local data with complete drivers from server
          setTableData((prevData) => {
            const newData = prevData.map((driver) => {
              const serverUpdated = result.updatedDrivers?.find(
                (d) => String(d.id) === String(driver.id)
              );
              // Log each driver update
              if (serverUpdated) {
                console.log(`Updating driver ${driver.id}:`, {
                  previousCompany: driver.company_name,
                  newCompany: serverUpdated.company_name,
                  previousDocs: driver.driver_licenses?.length || 0,
                  newDocs: serverUpdated.driver_licenses?.length || 0,
                });
              }
              return serverUpdated || driver;
            });

            console.log("Updated table data after deactivation:", newData);
            return newData;
          });
        }

        // Reset selection
        setRowSelection({});
        setSelectedDriverRow(null);
      } else {
        console.error("Failed to deactivate drivers:", result.error);
        toast({
          title: "Error",
          description: `Failed to deactivate drivers: ${result.error}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deactivating drivers:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate drivers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle row selection
  const handleRowClick = useCallback(
    (row: Row<Driver>) => {
      const driver = row.original;
      const driverId = String(driver.id);

      // Toggle row selection
      setSelectedDriverRow((prev) => (prev?.id === driver.id ? null : driver));

      // Sync with checkbox selection if we're selecting a driver
      if (selectedDriverRow?.id !== driver.id) {
        // Find the index of the clicked row in the tableData array
        const rowIndex = tableData.findIndex((d) => String(d.id) === driverId);
        if (rowIndex !== -1) {
          // Update the rowSelection state to include this row
          setRowSelection((prev) => {
            // If the row is already in selection (via checkbox), we'll keep previous selections
            const newSelection = { ...prev };

            // Clear any existing selection to ensure only one row is selected at a time
            // unless using checkboxes for multi-select
            if (Object.keys(prev).length === 0) {
              // No existing checkbox selections, so create a fresh selection
              return { [rowIndex]: true };
            } else if (prev[rowIndex]) {
              // This row is already selected via checkbox, so deselect it
              const { [rowIndex]: _, ...rest } = newSelection;
              return rest;
            } else {
              // Add this row to existing checkbox selections
              newSelection[rowIndex] = true;
              return newSelection;
            }
          });
        }
      } else {
        // We're deselecting, so clear the row selection
        const rowIndex = tableData.findIndex((d) => String(d.id) === driverId);
        if (rowIndex !== -1) {
          setRowSelection((prev) => {
            const { [rowIndex]: _, ...rest } = prev;
            return rest;
          });
        }
      }
    },
    [selectedDriverRow, tableData]
  );

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

  // Calculate if all selected rows have the same status to disable buttons accordingly
  const getSelectedDriverIds = useCallback((): number[] => {
    // Get IDs from row selection
    const rowSelectedIds = Object.keys(rowSelection)
      .map((index) => {
        const driver = tableData[parseInt(index, 10)];
        return Number(driver?.id);
      })
      .filter(Boolean);

    // Add the selected row's ID if present and not already included
    let driverIds = [...rowSelectedIds];
    if (
      selectedDriverRow?.id &&
      !rowSelectedIds.includes(Number(selectedDriverRow.id))
    ) {
      driverIds = [...rowSelectedIds, Number(selectedDriverRow.id)];
    }

    // Update selected ids state
    setSelectedIds(driverIds);

    // Also update selectedDrivers state with actual driver objects
    const driverObjects = driverIds.reduce(
      (acc, id) => {
        const driver = tableData.find((d) => Number(d.id) === id);
        if (driver) {
          acc[String(id)] = driver;
        }
        return acc;
      },
      {} as Record<string, Driver>
    );
    setSelectedDrivers(driverObjects);

    return driverIds;
  }, [
    rowSelection,
    tableData,
    selectedDriverRow,
    setSelectedIds,
    setSelectedDrivers,
  ]);

  // Determine if all selected drivers have the same status
  const { allSelectedActive, allSelectedInactive } = useMemo(() => {
    const selectedIds = getSelectedDriverIds();

    // If no drivers are selected, both flags are false
    if (selectedIds.length === 0) {
      return { allSelectedActive: false, allSelectedInactive: false };
    }

    // Check if all selected drivers have the same status
    const selectedDrivers = tableData.filter((d) =>
      selectedIds.includes(Number(d.id))
    );
    const activeDrivers = selectedDrivers.filter((d) => d.status === "active");
    const inactiveDrivers = selectedDrivers.filter(
      (d) =>
        d.status === "inactive" ||
        d.status === "terminated" ||
        d.status === "pending"
    );

    return {
      allSelectedActive: activeDrivers.length === selectedDrivers.length,
      allSelectedInactive: inactiveDrivers.length === selectedDrivers.length,
    };
  }, [getSelectedDriverIds, tableData]);

  // Handle the bulk action for activation/deactivation
  const handleBulkAction = useCallback(
    async (action: "activate" | "deactivate") => {
      const selectedIds = getSelectedDriverIds();

      if (selectedIds.length === 0) {
        toast({
          title: "No drivers selected",
          description:
            "Please select at least one driver to perform this action",
          variant: "destructive",
        });
        return;
      }

      if (action === "activate") {
        await handleActivateSelected();
      } else {
        await handleDeactivateSelected();
      }

      // Clear all selection states
      setSelectedDriverRow(null);
      setRowSelection({});
    },
    [getSelectedDriverIds, handleActivateSelected, handleDeactivateSelected]
  );

  return (
    <DataTable
      columns={columns}
      data={tableData}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      onRowClick={handleRowClick}
      onActivateSelected={() => handleBulkAction("activate")}
      onDeactivateSelected={() => handleBulkAction("deactivate")}
      isProcessing={isProcessing}
      selectedRow={selectedDriverRow}
      hasSelectedRow={!!selectedDriverRow}
      allSelectedActive={allSelectedActive}
      allSelectedInactive={allSelectedInactive}
    />
  );
}
