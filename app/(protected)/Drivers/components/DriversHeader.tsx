"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Users, UserCheck, AlertTriangle } from "lucide-react";
import { AddDriverDialog } from "./AddDriverDialog";
import { useDrivers } from "./DriversProvider";
import { updateDriverStatusAction } from "../server-actions";
import { updateDriverStatusLocally } from "../realtime";
import { toast } from "@/components/ui/use-toast";
import { Driver, Document } from "../types";
import { ProgressIndicator } from "./ProgressIndicator";

type DriverStatus = "active" | "inactive" | "terminated" | "pending";

interface ProgressUpdate {
  total: number;
  completed: number;
  message: string;
  type: "success" | "error" | "info";
  isVisible: boolean;
}

interface DriversHeaderProps {
  onSync?: () => void;
  onClearCache?: () => void;
  onAddDriver?: () => void;
  isSyncing?: boolean;
}

export function DriversHeader({
  onSync,
  onClearCache,
  onAddDriver,
  isSyncing = false,
}: DriversHeaderProps) {
  const {
    drivers,
    loading,
    refreshDrivers,
    setDrivers,
    updateDriverOptimistically,
    setProgressUpdate,
  } = useDrivers();

  const hasExpiringDocuments = (driver: Driver) => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const checkExpiration = (docs: Document[] = []) => {
      return docs.some((doc) => {
        const expirationDate = new Date(doc.expiration_date);
        return expirationDate <= thirtyDaysFromNow;
      });
    };

    return (
      checkExpiration(driver.driver_licenses) ||
      checkExpiration(driver.medical_cards) ||
      checkExpiration(driver.mvr_files)
    );
  };

  const activeDrivers = drivers.filter((d) => {
    const status = d.status?.toLowerCase();
    return status === "active";
  });

  const expiringDocsCount = drivers.filter(hasExpiringDocuments).length;

  const updateDriverStatus = async (
    driverId: string,
    newStatus: DriverStatus,
    isBatchUpdate: boolean = false
  ) => {
    try {
      console.log(
        `Attempting to update driver ${driverId} status to ${newStatus}`
      );

      // Find the current driver to log the change
      const currentDriver = drivers.find((d) => d.id === driverId);
      console.log(`Current driver status: ${currentDriver?.status}`);

      // Use the optimistic update from context
      updateDriverOptimistically(driverId, {
        status: newStatus,
        updated_at: new Date().toISOString(),
      });

      // Make the actual update
      const result = await updateDriverStatusAction(
        parseInt(driverId, 10),
        newStatus
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to update status");
      }

      // Only show toast for individual updates, not batch updates
      if (!isBatchUpdate) {
        toast({
          title: "Status Updated",
          description: `Driver status has been updated to ${newStatus} successfully.`,
        });
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      if (!isBatchUpdate) {
        toast({
          title: "Error",
          description: "Failed to update driver status. Please try again.",
          variant: "destructive",
        });
      }
      // Refresh drivers to get the correct state
      refreshDrivers();
      throw error; // Re-throw to be handled by batch update
    }
  };

  const updateMultipleDrivers = async (
    driverIds: string[],
    newStatus: DriverStatus
  ) => {
    try {
      // Initialize progress
      setProgressUpdate({
        total: driverIds.length,
        completed: 0,
        message: `Updating ${driverIds.length} drivers...`,
        type: "info",
        isVisible: true,
      });

      let completedCount = 0;
      // Process drivers sequentially to maintain order
      for (const driverId of driverIds) {
        await updateDriverStatus(driverId, newStatus, true);

        completedCount++;
        // Update progress after each driver
        setProgressUpdate({
          total: driverIds.length,
          completed: completedCount,
          message: `Updated ${completedCount} of ${driverIds.length} drivers`,
          type: "info",
          isVisible: true,
        });
      }

      // Show success message that stays visible until user dismisses
      setProgressUpdate({
        total: driverIds.length,
        completed: driverIds.length,
        message: `Successfully updated ${driverIds.length} drivers`,
        type: "success",
        isVisible: true,
      });
    } catch (error) {
      console.error("Error updating multiple drivers:", error);
      setProgressUpdate({
        total: driverIds.length,
        completed: 0,
        message: "Failed to update some drivers",
        type: "error",
        isVisible: true,
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Drivers</CardTitle>
          <CardDescription>
            Manage your drivers and their Stripe integrations
          </CardDescription>
        </CardHeader>
      </Card>
      <ProgressIndicator />
    </>
  );
}

export default DriversHeader;
