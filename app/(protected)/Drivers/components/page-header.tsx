"use client";

import { RefreshCw, Plus, Database, Settings, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDrivers } from "./DriversClientProvider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImportDrivers } from "./ImportDrivers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuItemIndicator } from "@radix-ui/react-dropdown-menu";

export function PageHeader() {
  const {
    syncWithServer,
    clearCache,
    isSyncing,
    showImportDialog,
    setShowImportDialog,
  } = useDrivers();

  const handleAddDriver = () => {
    setShowImportDialog(true);
  };

  return (
    <>
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-none rounded-lg shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Drivers
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage your drivers and their Stripe integrations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleAddDriver}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="flex items-center gap-2 cursor-default">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <Database className="h-3.5 w-3.5" />
                  <span className="font-medium">Server Rendered</span>
                </DropdownMenuItem>
                <hr />
                <DropdownMenuItem onClick={syncWithServer} disabled={isSyncing}>
                  <RefreshCw
                    className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")}
                  />
                  Sync Stripe
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearCache}>
                  <Trash className="h-4 w-4 mr-2" />
                  Clear Cache
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Import Drivers</DialogTitle>
          <ImportDrivers />
        </DialogContent>
      </Dialog>
    </>
  );
}
