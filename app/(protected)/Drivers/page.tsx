"use client";

import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { DriversProvider, useDrivers } from "./components/DriversProvider";
import { StatsCards } from "./components/stats-cards";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "./components/page-header";
import { clearDriverCaches, updateDriverStatusBatchAction } from "./actions";
import { PageTransition } from "@/components/ui/page-transition";
import { ImportDrivers } from "./components/ImportDrivers";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { CacheManager } from "./components/CacheManager";
import { deleteClientCache } from "@/utils/client-cache";

function DriversContent() {
  const { drivers, error, syncWithServer, setDrivers } = useDrivers();
  const { toast } = useToast();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Convert error to string for DataTable
  const errorMessage = error ? error.message : undefined;

  const handleClearCache = async () => {
    try {
      // Clear server-side cache
      await clearDriverCaches();

      // Clear client-side cache
      await deleteClientCache("drivers:client-list");
      localStorage.removeItem("drivers:client-list");
      localStorage.removeItem("drivers:client-list:timestamp");

      // Trigger IndexedDB cache clear
      window.dispatchEvent(new Event("clear-drivers-cache"));

      // Refresh data from server
      await syncWithServer();

      toast({
        title: "Cache cleared",
        description:
          "All caches have been cleared and data refreshed from the server.",
      });
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear the drivers cache. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await syncWithServer();
      toast({
        title: "Sync complete",
        description: "Successfully synchronized with Stripe.",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to synchronize with Stripe.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddDriver = () => {
    setShowImportDialog(true);
  };

  const handleActivateSelected = async (ids: number[]) => {
    const snapshot = [...drivers];
    try {
      setDrivers(
        drivers.map((driver) => ({
          ...driver,
          status: ids.includes(Number(driver.id)) ? "active" : driver.status,
        }))
      );

      await updateDriverStatusBatchAction(ids, "active");
    } catch (error) {
      setDrivers(snapshot);
      toast({
        title: "Error",
        description: "Failed to activate selected drivers.",
        variant: "destructive",
      });
    }
  };

  const handleDeactivateSelected = async (ids: number[]) => {
    const snapshot = [...drivers];
    try {
      setDrivers(
        drivers.map((driver) => ({
          ...driver,
          status: ids.includes(Number(driver.id)) ? "inactive" : driver.status,
        }))
      );

      await updateDriverStatusBatchAction(ids, "inactive");
    } catch (error) {
      setDrivers(snapshot);
      toast({
        title: "Error",
        description: "Failed to deactivate selected drivers.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        onSync={handleSync}
        onClearCache={handleClearCache}
        onAddDriver={handleAddDriver}
        isSyncing={isSyncing}
      />
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Import Drivers</DialogTitle>
          <ImportDrivers />
        </DialogContent>
      </Dialog>
      <StatsCards />
      <DataTable
        columns={columns}
        data={drivers}
        error={errorMessage}
        onActivateSelected={handleActivateSelected}
        onDeactivateSelected={handleDeactivateSelected}
        rowSelection={selectedRows}
        onRowSelectionChange={setSelectedRows}
      />
    </div>
  );
}

export default function DriversPage() {
  return (
    <DriversProvider>
      <PageTransition>
        <CacheManager />
        <DriversContent />
      </PageTransition>
    </DriversProvider>
  );
}
