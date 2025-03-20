import { Company } from "./types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Users,
  CreditCard,
  Truck,
  Receipt,
  Settings,
  CalendarClock,
  MapPin,
  CheckCircle,
  XCircle,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { CompanyUsers } from "./components/company-users";
import { CompanyDrivers } from "./components/company-drivers";
import { CompanySettings } from "./components/company-settings";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  syncStripeCustomer as getStripeSubscriptionDetails,
  updateSubscriptionQuantity,
  changeSubscriptionPlan,
  getAvailablePlans,
  addSubscriptionItem,
} from "./stripe-actions";
import { clearCompanyCache } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StripeTabs } from "./components/stripe-tabs";
import { toast } from "sonner";
import {
  subscriptionDetailsCache,
  CACHE_TTL,
  clearSubscriptionCache,
} from "./cache";
import { CompanyEditForm } from "./components/company-edit-form";

interface CompanySideDialogProps {
  company?: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (companyId: number, data: Partial<Company>) => Promise<void>;
  initialEditMode?: boolean;
}

// Update the statusStyles object with more pronounced colors for dark mode
const statusStyles = {
  active: {
    button: "text-emerald-600 dark:text-emerald-400",
    dropdown:
      "hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  inactive: {
    button: "text-red-600 dark:text-red-500",
    dropdown:
      "hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-500",
    icon: "text-red-600 dark:text-red-500",
  },
};

// Create a new interface for toggle status options
interface ToggleStatusOptions {
  cancelSubscription?: boolean;
  cancellationType?: "now" | "end_period";
  issueRefund?: boolean;
}

export function CompanySideDialog({
  company: initialCompany,
  open,
  onOpenChange,
  onUpdate,
  initialEditMode,
}: CompanySideDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [stripeData, setStripeData] = useState<any>(null);
  const [isLoadingStripe, setIsLoadingStripe] = useState(true);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);
  const [newItemPlanId, setNewItemPlanId] = useState<string>("");
  const { toast } = useToast();
  const [itemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicesPerPage] = useState(5);
  const [invoiceSortField, setInvoiceSortField] = useState<string>("date");
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<
    "asc" | "desc"
  >("asc");
  const [activeTab, setActiveTab] = useState<string>("details");
  const [company, setCompany] = useState<Company>(initialCompany as Company);
  const [isDialogContentLoading, setIsDialogContentLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode || false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  // This useEffect runs when the dialog opens/closes or the company changes
  useEffect(() => {
    if (open) {
      // Set edit mode from prop if provided
      setIsEditMode(initialEditMode || false);

      // Only set activeTab to overview when initially opening the dialog
      // Don't reset it if already open (which causes tab switching issues)
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
  if (!initialCompany) {
    return null;
  }

  // Add a specific effect for company updates from Settings tab
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-8">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading company data...</p>
      </div>
    </div>
  );

  const loadStripeData = async (showLoadingUI = true, forceRefresh = false) => {
    if (!company) return;

    if (showLoadingUI) {
      setIsDialogContentLoading(true);
    }

    try {
      // First check if we have cached data and force refresh is not requested
      const cached = !forceRefresh && subscriptionDetailsCache.get(company.id);
      if (
        cached &&
        cached.timestamp &&
        Date.now() - cached.timestamp < CACHE_TTL
      ) {
        console.log("Using cached Stripe data");
        setStripeData(cached.data);
        setIsLoadingStripe(false);
        setIsDialogContentLoading(false);
        return;
      }

      // No cache, expired, or force refresh - load from API
      console.log(`Loading Stripe data from API for company ${company.id}`);
      setIsLoadingStripe(true);

      try {
        const data = await getStripeSubscriptionDetails(company.id);
        console.log("Stripe data loaded successfully:", {
          customerId: data?.customer?.id,
          subscriptionId: data?.subscription?.id,
          subscriptionStatus: data?.subscription?.status,
        });

        setStripeData(data);

        // Update the cache
        subscriptionDetailsCache.set(company.id, {
          data: data,
          timestamp: Date.now(),
        });
        console.log(`Updated client-side cache for company ${company.id}`);
      } catch (apiError) {
        console.error("API error loading Stripe data:", apiError);
        throw apiError;
      }
    } catch (error) {
      console.error("Error loading Stripe data:", error);
      toast({
        title: "Error",
        description: "Failed to load Stripe data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStripe(false);
      setIsDialogContentLoading(false);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      const { plans } = await getAvailablePlans();
      setAvailablePlans(plans);
    } catch (error) {
      console.error("Error loading available plans:", error);
      toast({
        title: "Error",
        description: "Failed to load available plans",
        variant: "destructive",
      });
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setNewQuantity(item.quantity || 1);
    setSelectedPlanId(item.price.id);
    setEditDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    try {
      setIsUpdating(true);
      console.log("Starting subscription update process...");

      if (!stripeData?.subscription?.id) {
        console.error("No subscription ID found in stripeData", stripeData);
        toast({
          title: "Error",
          description: "No subscription found to update",
          variant: "destructive",
        });
        return;
      }

      if (editingItem.price.id !== selectedPlanId) {
        // Change plan
        console.log(
          `Changing plan from ${editingItem.price.id} to ${selectedPlanId}`
        );

        await changeSubscriptionPlan({
          subscriptionId: stripeData.subscription.id,
          itemId: editingItem.id,
          newPriceId: selectedPlanId,
        });

        console.log("Plan change successful");
      } else if (editingItem.quantity !== newQuantity) {
        // Update quantity
        console.log(
          `Updating quantity from ${editingItem.quantity} to ${newQuantity}`
        );

        await updateSubscriptionQuantity({
          subscriptionId: stripeData.subscription.id,
          itemId: editingItem.id,
          quantity: newQuantity,
        });

        console.log("Quantity update successful");
      } else {
        console.log("No changes detected in plan or quantity");
      }

      // Clear client-side cache for this company
      if (company?.id) {
        clearSubscriptionCache(company.id);
      }

      console.log("Refreshing subscription data...");
      // Refresh subscription data with force reload (bypass cache)
      await loadStripeData(true);

      setEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast({
        title: "Error",
        description:
          "Failed to update subscription. Please check console logs for details.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddSubscriptionItem = async () => {
    try {
      setIsUpdating(true);
      await addSubscriptionItem({
        subscriptionId: stripeData.subscription.id,
        priceId: newItemPlanId,
        quantity: newItemQuantity,
        metadata: {
          type: "subscription_item",
          description: "Subscription Item",
        },
      });

      // Refresh subscription data
      await loadStripeData();
      setAddItemDialogOpen(false);
      setNewItemQuantity(1);
      setNewItemPlanId("");
      toast({
        title: "Success",
        description: "Subscription item added successfully",
      });
    } catch (error) {
      console.error("Error adding subscription item:", error);
      toast({
        title: "Error",
        description: "Failed to add subscription item",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const sortAndFilterItems = (items: any[]) => {
    let filtered = [...items];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.price.product.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          item.metadata?.type?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue =
        sortField === "name"
          ? a.price.product.name
          : sortField === "price"
            ? a.price.unit_amount
            : sortField === "quantity"
              ? a.quantity || 0
              : "";
      let bValue =
        sortField === "name"
          ? b.price.product.name
          : sortField === "price"
            ? b.price.unit_amount
            : sortField === "quantity"
              ? b.quantity || 0
              : "";

      if (sortDirection === "desc") {
        [aValue, bValue] = [bValue, aValue];
      }

      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    });

    return filtered;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedAndFilteredItems = stripeData?.subscriptionItems
    ? sortAndFilterItems(stripeData.subscriptionItems)
    : [];

  const paginatedItems = sortedAndFilteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedAndFilteredItems.length / itemsPerPage);

  const sortAndFilterInvoices = (invoices: any[]) => {
    const sortedInvoices = [...invoices];

    // Apply sorting
    sortedInvoices.sort((a, b) => {
      let aValue =
        invoiceSortField === "date"
          ? new Date(a.created).getTime()
          : invoiceSortField === "amount"
            ? a.amount_due
            : a.status;
      let bValue =
        invoiceSortField === "date"
          ? new Date(b.created).getTime()
          : invoiceSortField === "amount"
            ? b.amount_due
            : b.status;

      if (invoiceSortDirection === "desc") {
        [aValue, bValue] = [bValue, aValue];
      }

      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    });

    return sortedInvoices;
  };

  const sortedInvoices = stripeData?.invoices
    ? sortAndFilterInvoices(stripeData.invoices)
    : [];

  const paginatedInvoices = sortedInvoices.slice(
    (invoicePage - 1) * invoicesPerPage,
    invoicePage * invoicesPerPage
  );

  const totalInvoicePages = Math.ceil(sortedInvoices.length / invoicesPerPage);

  const handleInvoiceSort = (field: string) => {
    if (invoiceSortField === field) {
      setInvoiceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setInvoiceSortField(field);
      setInvoiceSortDirection("asc");
    }
  };

  const handleConnectStripe = async () => {
    try {
      setIsLoadingStripe(true);
      const response = await fetch(`/api/stripe/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId: company.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to Stripe");
      }

      // Refresh the company data after connecting to Stripe
      await onUpdate(company.id, {
        stripe_customer_id: await response.text(),
      });
      toast({
        title: "Success",
        description: "Successfully connected to Stripe",
      });
    } catch (error) {
      console.error("Error connecting to Stripe:", error);
      toast({
        title: "Error",
        description: "Failed to connect to Stripe",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStripe(false);
    }
  };

  if (!initialCompany) {
    return null;
  }

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    try {
      return format(new Date(date), "MMM d, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  const handleUpdateCompany = async (data: Partial<Company>) => {
    try {
      setIsUpdating(true);
      await onUpdate(initialCompany.id, data);

      // Update the local company state with the new data to refresh all tabs
      setCompany((prevCompany) => {
        if (!prevCompany) return initialCompany;
        return { ...prevCompany, ...data };
      });

      toast({
        title: "Success",
        description: "Company updated successfully",
      });
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        title: "Error",
        description: "Failed to update company",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Update the handleToggleStatus function to use our API endpoint
  const handleToggleStatus = async (options?: ToggleStatusOptions) => {
    if (!company) return;

    try {
      setIsUpdating(true);
      const newStatus = company.status === "active" ? "inactive" : "active";

      const loadingToast = toast({
        title:
          company.status === "active"
            ? "Deactivating company..."
            : "Activating company...",
        description: "Please wait while we process your request.",
      });

      // Handle subscription cancellation if requested
      if (
        company.status === "active" &&
        options?.cancelSubscription &&
        company.stripe_subscription_id
      ) {
        console.log("Cancelling subscription with options:", options);

        try {
          // Call our API endpoint to cancel the subscription
          const response = await fetch(
            `/api/companies/${company.id}/subscription/cancel`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                atPeriodEnd: options.cancellationType === "end_period",
                issueRefund: options.issueRefund,
                updateStatus: true,
              }),
            }
          );

          if (!response.ok) {
            let errorMessage = "Failed to cancel subscription";
            try {
              const errorData = await response.json();
              errorMessage =
                errorData.details || errorData.error || errorMessage;
            } catch (jsonError) {
              console.error("Error parsing error response:", jsonError);
            }
            throw new Error(errorMessage);
          }

          // Handle successful response
          let resultText = "Subscription cancelled successfully";
          try {
            const result = await response.json();
            console.log("Subscription cancellation result:", result);
            resultText = result.message || resultText;
          } catch (jsonError) {
            // If response cannot be parsed as JSON, that's ok, just log it
            console.log(
              "Subscription cancelled successfully (no JSON response)"
            );
          }

          // Show success message
          toast({
            title: "Success",
            description: resultText,
          });
        } catch (subscriptionError) {
          console.error("Error cancelling subscription:", subscriptionError);
          loadingToast.dismiss();
          toast({
            title: "Error",
            description:
              subscriptionError instanceof Error
                ? subscriptionError.message
                : "Failed to cancel subscription",
            variant: "destructive",
          });
          throw subscriptionError; // Re-throw to prevent further processing
        }
      }

      // Update company status
      await onUpdate(company.id, { status: newStatus });

      // Update local state
      setCompany((prevCompany) => {
        if (!prevCompany) return company;
        return { ...prevCompany, status: newStatus };
      });

      loadingToast.dismiss();
      toast({
        title: "Success",
        description:
          company.status === "active"
            ? "Company deactivated successfully"
            : "Company activated successfully",
        variant: "default",
      });
    } catch (error) {
      console.error("Error updating company status:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update company status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // If switching to billing tab and we have a Stripe customer ID
    if (tab === "billing" && company?.stripe_customer_id) {
      // Show a brief loading indicator regardless of data status for consistent UX
      setIsLoadingStripe(true);

      if (!stripeData) {
        // If we don't have data yet, load it
        loadStripeData(true);
      } else {
        // We already have data, just show a brief loading indicator
        setTimeout(() => {
          setIsLoadingStripe(false);
        }, 300); // Brief loading indicator
      }
    }
  };

  const handleClearCompanyCache = async () => {
    if (!company?.id) return;

    try {
      setIsUpdating(true);
      const result = await clearCompanyCache(company.id);
      if (result.success) {
        toast({
          title: "Success",
          description: "Cache cleared successfully",
        });
        // Reload the data
        loadStripeData(true);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast({
        title: "Error",
        description: "Failed to clear cache",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
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
              {company.name}
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 capitalize",
                  company.status === "active"
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-400"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                )}
              >
                {company.status}
              </Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="h-full flex flex-col"
            >
              <div className="border-b px-6 py-3 bg-muted/10">
                <TabsList className="bg-background border rounded-lg p-0 shadow-sm">
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
                    <CreditCard className="h-4 w-4 mr-2" />
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
                    <LoadingSpinner />
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
                          <p className="text-base">{company.name}</p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Status
                          </h3>
                          <p className="text-base capitalize">
                            {company.status}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Created
                          </h3>
                          <p className="text-base">
                            {formatDate(company.created_at)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Last Updated
                          </h3>
                          <p className="text-base">
                            {formatDate(company.updated_at)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 p-6 border rounded-xl shadow-sm bg-card">
                        <h3 className="text-lg font-medium">
                          Contact Information
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Contact Name
                            </h4>
                            <p className="text-base">
                              {company.contact_first_name ||
                              company.contact_last_name
                                ? `${company.contact_first_name || ""} ${company.contact_last_name || ""}`.trim()
                                : "—"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Email
                            </h4>
                            <p className="text-base">
                              {company.contact_email ? (
                                <a
                                  href={`mailto:${company.contact_email}`}
                                  className="text-primary hover:underline"
                                >
                                  {company.contact_email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Phone
                            </h4>
                            <p className="text-base">
                              {company.contact_phone ? (
                                <a
                                  href={`tel:${company.contact_phone}`}
                                  className="text-primary hover:underline"
                                >
                                  {company.contact_phone}
                                </a>
                              ) : (
                                "—"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-6 border rounded-xl shadow-sm bg-card">
                        <h3 className="text-lg font-medium">
                          Address Information
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Street
                            </h4>
                            <p className="text-base">{company.street || "—"}</p>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              City
                            </h4>
                            <p className="text-base">{company.city || "—"}</p>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              State
                            </h4>
                            <p className="text-base">{company.state || "—"}</p>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-muted-foreground">
                              Zip Code
                            </h4>
                            <p className="text-base">{company.zip || "—"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Add any additional details sections here */}
                    </div>
                  )}
                </TabsContent>

                {/* Users Tab */}
                <TabsContent value="users" className="p-6" tabIndex={-1}>
                  <CompanyUsers company={company} />
                </TabsContent>

                {/* Drivers Tab */}
                <TabsContent value="drivers" className="p-6" tabIndex={-1}>
                  <CompanyDrivers company={company} />
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing" className="p-6" tabIndex={-1}>
                  {isLoadingStripe ? (
                    <LoadingSpinner />
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              setIsLoadingStripe(true);

                              // Clear the cache first
                              clearSubscriptionCache(company.id);

                              // Force refresh from Stripe with no cache
                              await loadStripeData(true, true);

                              toast({
                                title: "Success",
                                description:
                                  "Stripe data refreshed successfully",
                              });
                            } catch (error) {
                              console.error(
                                "Error refreshing Stripe data:",
                                error
                              );
                              toast({
                                title: "Error",
                                description: "Failed to refresh Stripe data",
                                variant: "destructive",
                              });
                            } finally {
                              setIsLoadingStripe(false);
                            }
                          }}
                          disabled={isLoadingStripe}
                        >
                          {isLoadingStripe ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Refreshing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Refresh Stripe Data
                            </>
                          )}
                        </Button>
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

                {/* Settings Tab */}
                <TabsContent value="settings" className="p-6" tabIndex={-1}>
                  <CompanySettings
                    company={company}
                    onUpdate={handleUpdateCompany}
                    onToggleStatus={handleToggleStatus}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
