"use client";

import { RefreshCw, Plus, Database, Settings, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompanies } from "../components/CompaniesClientProvider";
import { useState } from "react";
import { CompanyDialog } from "../company-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PageHeader() {
  const { syncWithServer, clearCache, isSyncing, handleCreateCompany } =
    useCompanies();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-none rounded-lg shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Companies
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage your companies and their Stripe integrations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Company
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

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateCompany}
      />
    </>
  );
}
