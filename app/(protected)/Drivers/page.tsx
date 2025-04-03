"use client";

import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { DriversProvider, useDrivers } from "./components/DriversProvider";
import { StatsCards } from "./components/stats-cards";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "./components/page-header";
import { clearDriverCaches } from "./actions";

export default function DriversPage() {
  return (
    <DriversProvider>
      <div className="space-y-6">
        <DriversContent />
      </div>
    </DriversProvider>
  );
}

function DriversContent() {
  const { drivers, loading, error, syncWithServer } = useDrivers();
  const { toast } = useToast();

  const handleClearCache = async () => {
    try {
      await clearDriverCaches();
      toast({
        title: "Cache cleared",
        description: "The drivers cache has been cleared successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear the drivers cache.",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    try {
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
    }
  };

  const handleAddDriver = () => {
    // TODO: Implement add driver functionality
    toast({
      title: "Coming Soon",
      description: "Add driver functionality will be implemented soon.",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        onSync={handleSync}
        onClearCache={handleClearCache}
        onAddDriver={handleAddDriver}
        isSyncing={loading}
      />
      <StatsCards />
      <DataTable
        columns={columns}
        data={drivers}
        loadingRows={
          loading ? Object.fromEntries(drivers.map((_, i) => [i, true])) : {}
        }
        error={error || undefined}
      />
    </div>
  );
}
