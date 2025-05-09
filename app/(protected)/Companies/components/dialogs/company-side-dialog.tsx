"use client";

import { Company } from "../../types";
import React, { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Truck,
  Receipt,
  Settings,
  CreditCard,
  Loader2,
  X,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyUsers } from "../company-users";
import dynamic from "next/dynamic";
// Import CompanyDrivers with dynamic to prevent SSR issues
const CompanyDrivers = dynamic(
  () =>
    import("../company-drivers").then((mod) => ({
      default: mod.CompanyDrivers,
    })),
  { ssr: false }
);
import { CompanySettings } from "../company-settings";
import { CompanyEditForm } from "../company-edit-form";
import { StripeTabs } from "../stripe-tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  getStripeSubscriptionDetails,
  getAvailablePlans,
} from "../../stripe-actions";

interface CompanySideDialogProps {
  company?: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (companyId: number, data: Partial<Company>) => Promise<void>;
  onDelete?: (companyId: number) => Promise<void>;
  initialEditMode?: boolean;
}

export function CompanySideDialog({
  company: initialCompany,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  initialEditMode,
}: CompanySideDialogProps) {
  const [company, setCompany] = useState<Company | undefined>(initialCompany);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode || false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
  const [stripeData, setStripeData] = useState<any>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [isDialogContentLoading, setIsDialogContentLoading] = useState(false);
  const { toast } = useToast();

  // Update local company state when initialCompany changes
  useEffect(() => {
    if (initialCompany?.id !== company?.id) {
      setCompany(initialCompany);
    }
  }, [initialCompany, company?.id]);

  // This useEffect runs when the dialog opens/closes or the company changes
  useEffect(() => {
    if (open) {
      // Set edit mode from prop if provided
      setIsEditMode(initialEditMode || false);

      // Only set activeTab to overview when initially opening the dialog
      if (!company) {
        setActiveTab("overview");
      }

      // Always use the latest company data from props
      if (initialCompany) {
        setCompany(initialCompany);
      }

      // Start fetching Stripe data in the background immediately when dialog opens
      if (initialCompany?.stripe_customer_id) {
        loadStripeData();
        loadAvailablePlans();
      }
    }
  }, [open, initialCompany, initialEditMode]);

  // This useEffect watches for tab changes to load Stripe data
  useEffect(() => {
    const fetchStripeData = async () => {
      if (!company?.id) return;

      try {
        setIsLoadingStripe(true);
        // Add a small delay to allow UI to render first
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log(`Fetching Stripe data for company ${company.id}...`);
        const startTime = performance.now();

        const stripeDetails = await getStripeSubscriptionDetails(company.id);

        const endTime = performance.now();
        console.log(
          `Stripe data loaded in ${Math.round(endTime - startTime)}ms`
        );

        setStripeData(stripeDetails);
      } catch (error) {
        console.error("Error fetching Stripe data:", error);
        setStripeError("Failed to load Stripe subscription details");
      } finally {
        setIsLoadingStripe(false);
      }
    };

    if (company?.stripe_customer_id && activeTab === "billing") {
      fetchStripeData();
    }
  }, [company, activeTab]);

  // Early return if no company is provided
  if (!company) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP");
    } catch (error) {
      return "Invalid Date";
    }
  };

  const handleUpdateCompany = async (data: Partial<Company>) => {
    if (!company?.id) return;

    try {
      setIsUpdating(true);
      await onUpdate(company.id, data);
      toast({
        title: "Company updated",
        description: "The company information has been updated successfully.",
      });

      // Update local company state with the new data
      setCompany((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        title: "Error",
        description: "Failed to update company information.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleToggleStatus = async () => {
    if (!company?.id) return;

    const newStatus = company.status === "active" ? "inactive" : "active";
    await handleUpdateCompany({ status: newStatus });
  };

  const loadStripeData = async () => {
    if (!company?.id) return;

    try {
      setIsLoadingStripe(true);
      const data = await getStripeSubscriptionDetails(company.id);
      setStripeData(data);
    } catch (error) {
      console.error("Error loading Stripe data:", error);
      setStripeError("Failed to load Stripe data");
    } finally {
      setIsLoadingStripe(false);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      await getAvailablePlans();
    } catch (error) {
      console.error("Error loading available plans:", error);
    }
  };

  const handleConnectStripe = async () => {
    if (!company?.id) return;

    try {
      setIsLoadingStripe(true);

      const response = await fetch(`/api/stripe/customers/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: company.id,
          name: company.name,
          email: company.contact_email || "no-email@example.com",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to Stripe");
      }

      const data = await response.json();

      // Update company locally with new Stripe ID
      setCompany((prev) =>
        prev ? { ...prev, stripe_customer_id: data.customerId } : prev
      );

      // Also update the company on the server
      await onUpdate(company.id, { stripe_customer_id: data.customerId });

      toast({
        title: "Stripe Connected",
        description: "Company has been connected to Stripe successfully.",
      });

      // Refresh Stripe data
      loadStripeData();
    } catch (error) {
      console.error("Error connecting to Stripe:", error);
      toast({
        title: "Error",
        description: "Failed to connect company to Stripe.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStripe(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <style jsx global>{`
        .radix-dialog-overlay {
          z-index: 9999 !important;
        }
        .radix-dialog-content {
          z-index: 10000 !important;
        }
      `}</style>
      <SheetContent
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-6xl p-0 overflow-hidden"
        side="right"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {company?.name || "Untitled Company"}
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 capitalize",
                  company?.status === "active"
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                )}
              >
                {company?.status || "unknown"}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs
              defaultValue="overview"
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <div className="px-6 pt-4 pb-2 border-b overflow-x-auto flex">
                <TabsList className="h-9 inline-flex items-center justify-center rounded-lg p-1 text-muted-foreground bg-muted/40">
                  <TabsTrigger
                    value="overview"
                    className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium transition-all"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="users"
                    className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium transition-all"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Users
                  </TabsTrigger>
                  <TabsTrigger
                    value="drivers"
                    className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium transition-all"
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Drivers
                  </TabsTrigger>
                  <TabsTrigger
                    value="billing"
                    className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium transition-all"
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Billing
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium transition-all"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <TabsContent
                  value="overview"
                  className="p-6 h-full"
                  tabIndex={-1}
                >
                  {isDialogContentLoading ? (
                    <div className="flex justify-center items-center h-[300px]">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : isEditMode ? (
                    <CompanyEditForm
                      company={company}
                      onUpdate={async (data) => {
                        await handleUpdateCompany(data);
                        setIsEditMode(false);
                      }}
                      onCancel={handleCancelEdit}
                      isUpdating={isUpdating}
                    />
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium">Company Details</h3>
                        <p className="text-sm text-muted-foreground">
                          View company information. Use the Settings tab to edit
                          details.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-6 p-6 border rounded-xl shadow-sm bg-card">
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Company Name
                          </h3>
                          <p className="text-base">{company?.name || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Status
                          </h3>
                          <p className="text-base capitalize">
                            {company?.status || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Created
                          </h3>
                          <p className="text-base">
                            {company?.created_at
                              ? formatDate(company.created_at)
                              : "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Contact Name
                          </h3>
                          <p className="text-base">
                            {company?.contact_first_name}{" "}
                            {company?.contact_last_name}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Contact Email
                          </h3>
                          <p className="text-base">
                            {company?.contact_email || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Contact Phone
                          </h3>
                          <p className="text-base">
                            {company?.contact_phone || "—"}
                          </p>
                        </div>
                        {(company?.street ||
                          company?.city ||
                          company?.state ||
                          company?.zip) && (
                          <>
                            <div className="space-y-1">
                              <h3 className="text-sm font-medium text-muted-foreground">
                                Street Address
                              </h3>
                              <p className="text-base">
                                {company?.street || "—"}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-sm font-medium text-muted-foreground">
                                City, State, ZIP
                              </h3>
                              <p className="text-base">
                                {[company?.city, company?.state, company?.zip]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </p>
                            </div>
                          </>
                        )}
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Timezone
                          </h3>
                          <p className="text-base">
                            {company?.timezone || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Notifications
                          </h3>
                          <p className="text-base">
                            {company?.notifications_enabled
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Auto Invoice
                          </h3>
                          <p className="text-base">
                            {company?.auto_invoice ? "Enabled" : "Disabled"}
                          </p>
                        </div>
                        {company?.subscription_status && (
                          <div className="space-y-1">
                            <h3 className="text-sm font-medium text-muted-foreground">
                              Subscription Status
                            </h3>
                            <p className="text-base capitalize">
                              {company?.subscription_status || "—"}
                            </p>
                          </div>
                        )}
                        {company?.last_invoice_date && (
                          <div className="space-y-1">
                            <h3 className="text-sm font-medium text-muted-foreground">
                              Last Invoice
                            </h3>
                            <div className="flex items-center">
                              <span className="text-base">
                                {formatDate(company.last_invoice_date)}
                              </span>
                              {company?.last_invoice_status && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "ml-2 capitalize",
                                    company?.last_invoice_status === "paid"
                                      ? "border-green-200 bg-green-50 text-green-700"
                                      : "border-amber-200 bg-amber-50 text-amber-700"
                                  )}
                                >
                                  {company.last_invoice_status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="users" className="p-6" tabIndex={-1}>
                  <CompanyUsers company={company} />
                </TabsContent>

                <TabsContent value="drivers" className="p-6" tabIndex={-1}>
                  <CompanyDrivers company={company} />
                </TabsContent>

                <TabsContent value="billing" className="p-6" tabIndex={-1}>
                  {isLoadingStripe ? (
                    <div className="flex justify-center items-center h-[300px]">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : company.stripe_customer_id ? (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-medium">
                            Billing & Subscriptions
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Manage subscriptions, payment methods and invoices
                          </p>
                        </div>
                      </div>

                      <StripeTabs
                        company={company}
                        preloadedData={stripeData}
                        isLoading={isLoadingStripe}
                      />
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-lg font-medium">
                        No Stripe Integration
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                        This company is not yet connected to Stripe. Connect to
                        Stripe to manage billing and subscriptions.
                      </p>
                      <Button
                        onClick={handleConnectStripe}
                        className="mt-4"
                        disabled={isLoadingStripe}
                      >
                        {isLoadingStripe ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Connect to Stripe
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="settings" className="p-6" tabIndex={-1}>
                  <CompanySettings
                    company={company}
                    onUpdate={handleUpdateCompany}
                    onToggleStatus={handleToggleStatus}
                  />

                  {onDelete && (
                    <div className="mt-6 pt-6 border-t">
                      <div className="flex flex-col space-y-2">
                        <h3 className="text-lg font-semibold text-destructive">
                          Danger Zone
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Permanently delete this company and all of its data
                        </p>
                        <div className="mt-2">
                          <Button
                            variant="destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to delete this company? This action cannot be undone."
                                )
                              ) {
                                onDelete(company.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Company
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
