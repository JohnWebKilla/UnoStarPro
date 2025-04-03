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
import type { Company, CompanyMeta, ToggleStatusOptions } from "./types";
import { openDB, IDBPDatabase } from "idb";
import { PageHeader } from "./components/page-header";
import { PageTransition } from "@/components/ui/page-transition";

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
      await clearCompanyCache();
      await refreshCompanies();
      toast({
        title: "Success",
        description: "Cache cleared successfully",
      });
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to clear cache",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCompanies = async (
    ids: number[],
    status: "active" | "inactive"
  ) => {
    try {
      await Promise.all(ids.map((id) => updateCompany(id, { status })));
      await refreshCompanies();
      toast({
        title: "Success",
        description: `Companies ${status === "active" ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      console.error("Error updating companies:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update companies",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (options?: ToggleStatusOptions) => {
    if (!companyToDeactivate) return;
    try {
      await handleUpdateCompany(companyToDeactivate.id, {
        status: "inactive",
        ...options,
      });
      setShowDeactivationDialog(false);
      setCompanyToDeactivate(undefined);
    } catch (error) {
      console.error("Error toggling status:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDialogSubmit = (data: Partial<Company>) => {
    if (editDialogMode && selectedCompany) {
      return handleUpdateCompany(selectedCompany.id, data);
    }
    return handleCreateCompany(data);
  };

  if (!companies) {
    return <TableSkeleton />;
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        <PageHeader
          onSync={handleSyncAllStripe}
          onClearCache={handleClearCache}
          onAddCompany={() => setDialogOpen(true)}
          isSyncing={isSyncing}
        />
        <SummaryCards companies={companies} />
        <DataTable
          columns={columns}
          data={companies}
          loadingRows={loadingRows}
          error={companiesError || undefined}
          meta={{
            onRowClick: (company: Company) => {
              setSelectedCompany(company);
              setSideDialogOpen(true);
            },
            onEdit: (company: Company) => {
              setSelectedCompany(company);
              setEditDialogMode(true);
              setDialogOpen(true);
            },
            onUpdateStatus: (company: Company) => {
              setCompanyToDeactivate(company);
              setShowDeactivationDialog(true);
            },
            onSyncStripe: handleSyncStripe,
            onStripeSettings: (company: Company) => {
              setSelectedCompany(company);
              setStripeDialogOpen(true);
            },
            onConnectStripe: handleSyncStripe,
          }}
          onUpdateCompanies={handleUpdateCompanies}
        />
        <CompanyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          company={selectedCompany}
          onSubmit={handleDialogSubmit}
        />
        <StripeDialog
          open={stripeDialogOpen}
          onOpenChange={setStripeDialogOpen}
          company={selectedCompany}
        />
        <CompanySideDialog
          open={sideDialogOpen}
          onOpenChange={setSideDialogOpen}
          company={selectedCompany}
          onUpdate={handleUpdateCompany}
        />
        {companyToDeactivate && (
          <DeactivationDialog
            open={showDeactivationDialog}
            company={companyToDeactivate}
            onToggleStatus={handleToggleStatus}
            onCancel={() => {
              setShowDeactivationDialog(false);
              setCompanyToDeactivate(undefined);
            }}
          />
        )}
      </div>
    </PageTransition>
  );
}
