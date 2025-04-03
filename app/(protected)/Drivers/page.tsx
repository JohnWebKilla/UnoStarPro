"use client";

import { DataTable } from "./components/data-table";
import { columns } from "./components/columns";
import { DriversProvider, useDrivers } from "./components/DriversProvider";
import { StatsCards } from "./components/stats-cards";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { clearDriverCaches } from "./actions";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";

export default function DriversPage() {
  return (
    <DriversProvider>
      <div className="flex-1 space-y-4 p-8">
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

  return (
    <>
      <Card>
        <CardContent className="py-4 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Drivers</h2>
              <p className="text-muted-foreground">
                Manage your drivers and their Stripe integrations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200 flex gap-1.5 items-center h-7 px-3 text-sm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Local Cache
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  className="h-7 px-3 text-sm font-medium"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Stripe
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearCache}
                  className="h-7 px-3 text-sm font-medium"
                >
                  Clear Cache
                </Button>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white h-7 px-3 text-sm font-medium"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Driver
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <StatsCards />
      <div className="space-y-4">
        <DataTable
          columns={columns}
          data={drivers}
          loadingRows={
            loading ? Object.fromEntries(drivers.map((_, i) => [i, true])) : {}
          }
          error={error || undefined}
        />
      </div>
    </>
  );
}
