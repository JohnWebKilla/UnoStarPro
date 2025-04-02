"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  RefreshCw,
  Trash2,
  Loader2,
  Plus,
  Database,
} from "lucide-react";
import { CompanyDialog } from "./company-dialog";
import { StripeDialog } from "./stripe-dialog";
import { CompanySideDialog } from "./company-side-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  getCompanies,
  createCompany,
  updateCompany,
  clearCompanyCache,
} from "./actions";
import { syncStripeCustomers, syncStripeCustomer } from "./stripe-actions";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { setupCompaniesSubscription } from "./realtime";
import { TableSkeleton } from "./table-skeleton";
import { cn } from "@/lib/utils";
import { SummaryCards } from "./summary-cards";
import { syncStripeCustomer as getStripeSubscriptionDetails } from "./stripe-actions";
import { subscriptionDetailsCache, CACHE_TTL } from "./cache";
import { DeactivationDialog } from "./components/deactivation-dialog";
import { Badge } from "@/components/ui/badge";
import { useCompanies } from "./hooks/useCompanies";
import type { Company } from "./types";
import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "companiesDB";
const STORE_NAME = "companies";

async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db: IDBPDatabase) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

interface ToggleStatusOptions {
  cancelSubscription?: boolean;
  cancellationType?: "now" | "end_period";
  issueRefund?: boolean;
}

export default function CompaniesPage() {
  const { companies, error: companiesError, refreshCompanies } = useCompanies();
  const [loadingRows, setLoadingRows] = useState<Record<number, boolean>>({});
  const [syncingRowIds, setSyncingRowIds] = useState<Record<number, number>>(
    {}
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [sideDialogOpen, setSideDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [editDialogMode, setEditDialogMode] = useState(false);
  const [showDeactivationDialog, setShowDeactivationDialog] = useState(false);
  const [companyToDeactivate, setCompanyToDeactivate] = useState<
    Company | undefined
  >();
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    const channel = setupCompaniesSubscription(async (payload) => {
      if (
        payload.eventType === "UPDATE" ||
        payload.eventType === "INSERT" ||
        payload.eventType === "DELETE"
      ) {
        await refreshCompanies();
      }
    });

    return () => {
      if (channel) {
        console.log("Cleaning up real-time subscription");
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, [refreshCompanies, supabase]);

  const handleCreateCompany = async (data: Partial<Company>) => {
    try {
      await createCompany(data);
      await refreshCompanies();
      setDialogOpen(false);
      toast({
        title: "Success",
        description: "Company created successfully",
      });
    } catch (error) {
      console.error("Error creating company:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create company",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCompany = async (
    companyId: number,
    data: Partial<Company>
  ) => {
    try {
      await updateCompany(companyId, data);
      await refreshCompanies();
      toast({
        title: "Success",
        description: "Company updated successfully",
      });
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update company",
        variant: "destructive",
      });
    }
  };

  const handleSyncAllStripe = async () => {
    try {
      setIsSyncing(true);
      await syncStripeCustomers();
      await refreshCompanies();
      toast({
        title: "Success",
        description: "All companies synced with Stripe successfully",
      });
    } catch (error) {
      console.error("Error syncing companies with Stripe:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to sync with Stripe",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncStripe = async (company: Company) => {
    try {
      // Check if this company was synced recently (within 10 seconds)
      const lastSyncTime = syncingRowIds[company.id];
      const currentTime = Date.now();

      if (lastSyncTime && currentTime - lastSyncTime < 10000) {
        console.log(
          `Skipping sync for ${company.name} - already synced recently`
        );
        toast({
          title: "Info",
          description:
            "This company was synced recently. Please wait a moment before syncing again.",
        });
        return;
      }

      // Record sync time and set loading state
      setSyncingRowIds((prev) => ({ ...prev, [company.id]: currentTime }));
      setLoadingRows((prev) => ({ ...prev, [company.id]: true }));

      await syncStripeCustomer(company.id);
      await refreshCompanies();

      toast({
        title: "Success",
        description: "Company synced with Stripe successfully",
      });
    } catch (error) {
      console.error("Error syncing company with Stripe:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to sync company with Stripe",
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [company.id]: false }));

      // After 10 seconds, remove the company from the syncing list
      setTimeout(() => {
        setSyncingRowIds((prev) => {
          const newState = { ...prev };
          delete newState[company.id];
          return newState;
        });
      }, 10000);
    }
  };

  const handleClearCache = async () => {
    try {
      setIsSyncing(true);
      // Clear both server cache and IndexedDB
      await clearCompanyCache();
      const db = await initDB();
      await db.clear(STORE_NAME);
      await refreshCompanies();
      toast({
        title: "Success",
        description: "Cache cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear cache",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Companies</h1>
          <div className="flex items-center">
            <p className="text-muted-foreground">
              Manage your companies and their Stripe integrations
            </p>
            {companiesError && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm ml-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {companiesError}
              </div>
            )}
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 flex items-center gap-1 ml-2"
            >
              <Database className="h-3 w-3" />
              IndexedDB Cache
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncAllStripe}
            disabled={isSyncing}
            className="h-9"
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync Stripe
          </Button>
          <Button
            variant="outline"
            onClick={handleClearCache}
            disabled={isSyncing}
            className="h-9"
          >
            Clear Cache
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="h-9">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      <SummaryCards companies={companies} />

      <DataTable
        columns={columns}
        data={companies}
        loadingRows={loadingRows}
        meta={{
          onEdit: (company) => {
            setSelectedCompany(company);
            setDialogOpen(true);
          },
          onUpdateStatus: (company) => {
            setCompanyToDeactivate(company);
            setShowDeactivationDialog(true);
          },
          onSyncStripe: handleSyncStripe,
          onStripeSettings: (company) => {
            setSelectedCompany(company);
            setStripeDialogOpen(true);
          },
          onConnectStripe: handleSyncStripe,
          onRowClick: (company) => {
            setSelectedCompany(company);
            setSideDialogOpen(true);
            setEditDialogMode(false);
          },
        }}
        error={companiesError || undefined}
      />

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        company={selectedCompany}
        onSubmit={
          selectedCompany
            ? (data) => handleUpdateCompany(selectedCompany.id, data)
            : handleCreateCompany
        }
      />

      <StripeDialog
        open={stripeDialogOpen}
        onOpenChange={setStripeDialogOpen}
        company={selectedCompany}
        onSubmit={
          selectedCompany
            ? (data) => handleUpdateCompany(selectedCompany.id, data)
            : undefined
        }
      />

      {selectedCompany && (
        <CompanySideDialog
          open={sideDialogOpen}
          onOpenChange={(open) => {
            setSideDialogOpen(open);
            if (!open) {
              setEditDialogMode(false);
            }
          }}
          company={selectedCompany}
          onUpdate={handleUpdateCompany}
          initialEditMode={editDialogMode}
        />
      )}

      {companyToDeactivate && (
        <DeactivationDialog
          company={companyToDeactivate}
          onToggleStatus={async (options) => {
            try {
              await handleUpdateCompany(companyToDeactivate.id, {
                status: "inactive",
              });
              setShowDeactivationDialog(false);
              setCompanyToDeactivate(undefined);
            } catch (error) {
              console.error("Error deactivating company:", error);
            }
          }}
          onCancel={() => {
            setShowDeactivationDialog(false);
            setCompanyToDeactivate(undefined);
          }}
          open={showDeactivationDialog}
        />
      )}
    </div>
  );
}
