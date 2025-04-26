"use client";

import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { DriversProvider, useDrivers } from "./components/DriversProvider";
import { StatsCards } from "./components/stats-cards";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "./components/page-header";
import { clearDriverCaches } from "./actions";
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
import { useRouter } from "next/navigation";

function DriversContent() {
  const { drivers, error, syncWithServer } = useDrivers();
  const { toast } = useToast();
  const router = useRouter();
  const [showImportDialog, setShowImportDialog] = useState(false);
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

  const handleRowClick = (driverId: string) => {
    router.push(`/Drivers/${driverId}`);
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
        onRowClick={handleRowClick}
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
