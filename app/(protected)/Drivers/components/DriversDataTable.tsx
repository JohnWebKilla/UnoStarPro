"use client";

import { Row, RowSelectionState, OnChangeFn } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Driver } from "../types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDrivers } from "./DriversClientProvider";
import { usePathname } from "next/navigation";

interface DriversDataTableProps {
  data: Driver[];
}

export function DriversDataTable({ data: initialData }: DriversDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { drivers: contextDrivers, setSelectedDriver } = useDrivers();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isPrefetched, setIsPrefetched] = useState<Record<string, boolean>>({});

  // Use both the initial server data and any updates from context
  const [tableData, setTableData] = useState<Driver[]>(initialData);

  // Update table data when context drivers change
  useEffect(() => {
    if (contextDrivers && contextDrivers.length > 0) {
      console.log("Updating DriversDataTable with new data from context", {
        contextDriversCount: contextDrivers.length,
        initialDataCount: initialData.length,
      });
      setTableData([...contextDrivers]);
    }
  }, [contextDrivers, initialData]);

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

  // Handle activating selected drivers
  const handleActivateSelected = async (ids: number[]) => {
    console.log("Activating drivers with IDs:", ids);
    setRowSelection({});
  };

  // Handle deactivating selected drivers
  const handleDeactivateSelected = async (ids: number[]) => {
    console.log("Deactivating drivers with IDs:", ids);
    setRowSelection({});
  };

  // Log when data changes for debugging
  useEffect(() => {
    console.log(
      "DriversDataTable rendering with data length:",
      tableData.length
    );
  }, [tableData]);

  return (
    <DataTable
      columns={columns}
      data={tableData}
      onRowDoubleClick={handleRowDoubleClick}
      onViewDetails={handleViewDetails}
      rowSelection={rowSelection}
      onRowSelectionChange={handleRowSelectionChange}
      onActivateSelected={handleActivateSelected}
      onDeactivateSelected={handleDeactivateSelected}
    />
  );
}
