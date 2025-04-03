"use client";

import { RefreshCw, Plus, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  onClearCache: () => void;
  onAddDriver: () => void;
  isLoading: boolean;
  dataSource: string;
}

export function PageHeader({
  onClearCache,
  onAddDriver,
  isLoading,
  dataSource,
}: PageHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-none rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Drivers
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage your drivers and their documents
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dataSource && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-md text-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <Database className="h-3.5 w-3.5" />
              <span className="font-medium">
                {dataSource === "IndexedDB"
                  ? "IndexedDB Cache"
                  : dataSource === "Client Cache (Local)"
                    ? "Local Cache"
                    : dataSource === "Redis Cache"
                      ? "Redis Cache"
                      : "Database"}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onClearCache}
            className="h-9"
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
            />
            Clear Cache
          </Button>
          <Button
            size="sm"
            onClick={onAddDriver}
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Driver
          </Button>
        </div>
      </div>
    </div>
  );
}
