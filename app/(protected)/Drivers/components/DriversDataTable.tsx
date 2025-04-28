"use client";

import { Row, RowSelectionState, OnChangeFn } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Driver } from "../types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface DriversDataTableProps {
  data: Driver[];
}

export function DriversDataTable({ data }: DriversDataTableProps) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Prefetch all driver detail routes to make navigation feel instant
  useEffect(() => {
    data.forEach((driver) => {
      if (driver.id) {
        router.prefetch(`/Drivers/${driver.id}`);
      }
    });
  }, [data, router]);

  // Handle row selection change
  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback(
    (updater) => {
      setRowSelection(updater);
    },
    []
  );

  // Create a row double-click handler with instant feedback
  const handleRowDoubleClick = useCallback(
    (row: Row<Driver>) => {
      const driverId = row?.original?.id;
      if (driverId) {
        // Show loading state immediately and navigate
        document.body.classList.add("cursor-progress");
        router.push(`/Drivers/${driverId}`);

        // Reset cursor after a short delay in case navigation is fast
        setTimeout(() => {
          document.body.classList.remove("cursor-progress");
        }, 500);
      } else {
        console.warn("Row double-clicked but no driver ID found", row);
      }
    },
    [router]
  );

  // Handle activating selected drivers
  const handleActivateSelected = async (ids: number[]) => {
    // Implement your activation logic here
    console.log("Activating drivers with IDs:", ids);
    // Reset selection after action
    setRowSelection({});
  };

  // Handle deactivating selected drivers
  const handleDeactivateSelected = async (ids: number[]) => {
    // Implement your deactivation logic here
    console.log("Deactivating drivers with IDs:", ids);
    // Reset selection after action
    setRowSelection({});
  };

  return (
    <DataTable
      columns={columns}
      data={data}
      onRowDoubleClick={handleRowDoubleClick}
      rowSelection={rowSelection}
      onRowSelectionChange={handleRowSelectionChange}
      onActivateSelected={handleActivateSelected}
      onDeactivateSelected={handleDeactivateSelected}
    />
  );
}
