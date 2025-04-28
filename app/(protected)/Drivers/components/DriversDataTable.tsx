"use client";

import { Row } from "@tanstack/react-table";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Driver } from "../types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

interface DriversDataTableProps {
  data: Driver[];
}

export function DriversDataTable({ data }: DriversDataTableProps) {
  const router = useRouter();

  // Prefetch all driver detail routes to make navigation feel instant
  useEffect(() => {
    data.forEach((driver) => {
      if (driver.id) {
        router.prefetch(`/Drivers/${driver.id}`);
      }
    });
  }, [data, router]);

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

  return (
    <DataTable
      columns={columns}
      data={data}
      onRowDoubleClick={handleRowDoubleClick}
    />
  );
}
