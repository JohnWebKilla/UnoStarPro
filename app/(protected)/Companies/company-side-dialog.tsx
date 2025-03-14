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
  getStripeSubscriptionDetails,
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
import { subscriptionDetailsCache, CACHE_TTL } from "./cache";

interface CompanySideDialogProps {
  company?: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (companyId: number, data: Partial<Company>) => Promise<void>;
  onDelete?: (companyId: number) => Promise<void>;
}

const statusStyles = {
  active: {
    button: "text-emerald-600 dark:text-emerald-400",
    dropdown:
      "hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  inactive: {
    button: "text-red-600 dark:text-red-400",
    dropdown:
      "hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400",
    icon: "text-red-600 dark:text-red-400",
  },
};

export function CompanySideDialog({
  company: initialCompany,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: CompanySideDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [stripeData, setStripeData] = useState<any>(null);
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
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
  const [company, setCompany] = useState<Company | null>(null);

  // Use useMemo to create a stable reference to the company
  const companyMemo = useMemo(() => {
    if (!initialCompany) return null;
    return initialCompany;
  }, [initialCompany]);

  // Early return if no company is provided
  if (!companyMemo) {
    return null;
  }

  // Set the active tab to "details" when the dialog opens and start background data loading
  useEffect(() => {
    if (open && companyMemo) {
      // Update local state when dialog opens
      setActiveTab("overview");
      setCompany(companyMemo);

      // Start fetching Stripe data in the background immediately when dialog opens
      if (companyMemo?.stripe_customer_id) {
        // Check for cached data first
        const cachedData = subscriptionDetailsCache.get(companyMemo.id);
        const now = Date.now();

        if (cachedData && now - cachedData.timestamp < CACHE_TTL) {
          // Use cached data if it's less than 5 minutes old
          setStripeData(cachedData.data);
          setIsLoadingStripe(false);
          console.log("Using cached Stripe data");
        } else {
          // Set loading state but don't block the UI
          setIsLoadingStripe(true);

          // Start loading data in the background
          console.log("Loading fresh Stripe data in background");

          // Use setTimeout to defer the loading to the next tick
          setTimeout(() => {
            loadStripeData(false)
              .then(() => {
                setIsLoadingStripe(false);
              })
              .catch((error) => {
                console.error("Error loading Stripe data:", error);
                setIsLoadingStripe(false);
              });
          }, 0);
        }

        // Only load plans if we don't have them yet
        if (!availablePlans.length) {
          loadAvailablePlans();
        }
      }
    }
  }, [open]); // Only depend on open state to prevent refetching

  const loadStripeData = async (showLoadingUI = true) => {
    if (!companyMemo) return;

    try {
      // Only show loading UI if explicitly requested (when clicking billing tab)
      if (showLoadingUI) {
        setIsLoadingStripe(true);
      }

      console.log("Fetching Stripe data from API");
      const data = await getStripeSubscriptionDetails(companyMemo.id);
      console.log("Stripe data fetched successfully");
      setStripeData(data);

      // Update the shared cache
      subscriptionDetailsCache.set(companyMemo.id, {
        data: data,
        timestamp: Date.now(),
      });

      // Only manage loading state if showLoadingUI is true
      if (showLoadingUI) {
        // Ensure loading state is visible for a minimum time
        setTimeout(() => {
          setIsLoadingStripe(false);
        }, 1000); // 1 second minimum loading time for better UX
      }
    } catch (error) {
      console.error("Error loading Stripe data:", error);
      if (showLoadingUI) {
        toast({
          title: "Error",
          description: "Failed to load subscription details",
          variant: "destructive",
        });
        setIsLoadingStripe(false);
      }
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

      if (editingItem.price.id !== selectedPlanId) {
        // Change plan
        await changeSubscriptionPlan({
          subscriptionId: stripeData.subscription.id,
          itemId: editingItem.id,
          newPriceId: selectedPlanId,
        });
      } else if (editingItem.quantity !== newQuantity) {
        // Update quantity
        await updateSubscriptionQuantity({
          subscriptionId: stripeData.subscription.id,
          itemId: editingItem.id,
          quantity: newQuantity,
        });
      }

      // Refresh subscription data
      await loadStripeData();
      setEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast({
        title: "Error",
        description: "Failed to update subscription",
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
    let sortedInvoices = [...invoices];

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
        body: JSON.stringify({ companyId: companyMemo.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to Stripe");
      }

      // Refresh the company data after connecting to Stripe
      await onUpdate(companyMemo.id, {
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

      // Show loading toast
      const loadingToast = toast({
        title: "Updating company...",
        description: "Please wait while we save your changes.",
      });

      // Perform the update
      await onUpdate(companyMemo.id, data);

      // Dismiss loading toast and show success
      loadingToast.dismiss();
      toast({
        title: "Success",
        description: "Company updated successfully",
        variant: "default",
      });
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update company",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyMemo || !onDelete) return;

    try {
      setIsUpdating(true);
      const loadingToast = toast({
        title: "Deleting company...",
        description: "Please wait while we process your request.",
      });

      await onDelete(companyMemo.id);
      onOpenChange(false);

      loadingToast.dismiss();
      toast({
        title: "Success",
        description: "Company deleted successfully",
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting company:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete company",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // If switching to billing tab and we have a Stripe customer ID
    if (tab === "billing" && companyMemo?.stripe_customer_id) {
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
    if (!companyMemo?.id) return;

    try {
      setIsUpdating(true);
      const result = await clearCompanyCache(companyMemo.id);
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
              {companyMemo.name}
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 capitalize",
                  companyMemo.status === "active"
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                )}
              >
                {companyMemo.status}
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
                  className="p-4 h-full"
                  tabIndex={-1}
                >
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6 p-6 border rounded-xl shadow-sm bg-card">
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Company Name
                        </h3>
                        <p className="text-base">{companyMemo.name}</p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Status
                        </h3>
                        <p className="text-base capitalize">
                          {companyMemo.status}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Created
                        </h3>
                        <p className="text-base">
                          {formatDate(companyMemo.created_at)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Last Updated
                        </h3>
                        <p className="text-base">
                          {formatDate(companyMemo.updated_at)}
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
                            Email
                          </h4>
                          <p className="text-base">
                            {companyMemo.contact_email || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Phone
                          </h4>
                          <p className="text-base">
                            {companyMemo.contact_phone || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 border rounded-xl shadow-sm bg-card">
                      <h3 className="text-lg font-medium">Address</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Street
                          </h4>
                          <p className="text-base">
                            {companyMemo.street || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            City
                          </h4>
                          <p className="text-base">{companyMemo.city || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            State
                          </h4>
                          <p className="text-base">
                            {companyMemo.state || "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Zip
                          </h4>
                          <p className="text-base">{companyMemo.zip || "—"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="users" className="p-6 h-full" tabIndex={-1}>
                  <CompanyUsers company={companyMemo} />
                </TabsContent>

                <TabsContent
                  value="drivers"
                  className="p-6 h-full"
                  tabIndex={-1}
                >
                  <CompanyDrivers company={companyMemo} />
                </TabsContent>

                <TabsContent
                  value="billing"
                  className="px-4 py-2 h-full"
                  tabIndex={-1}
                >
                  {isLoadingStripe ? (
                    <div className="flex flex-col items-center justify-center space-y-6 p-10 min-h-[400px] border rounded-xl shadow-sm bg-background">
                      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      </div>
                      <div className="text-center space-y-3">
                        <h3 className="text-xl font-medium">
                          Loading Billing Information
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          Please wait while we retrieve your billing data. This
                          may take a few moments...
                        </p>
                      </div>
                      <div className="w-full max-w-md h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary animate-pulse rounded-full"
                          style={{ width: "75%" }}
                        ></div>
                      </div>
                    </div>
                  ) : companyMemo.stripe_customer_id ? (
                    <>
                      <StripeTabs
                        company={companyMemo}
                        preloadedData={stripeData}
                        isLoading={isLoadingStripe}
                        defaultTab="subscription"
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-10 space-y-4 min-h-[400px] border rounded-xl shadow-sm">
                      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                        <CreditCard className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-medium">
                          No Billing Setup
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          This company hasn't been connected to Stripe yet.
                          Connect to enable billing features.
                        </p>
                      </div>
                      <Button
                        onClick={handleConnectStripe}
                        className="mt-4"
                        size="lg"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Connect to Stripe
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="settings"
                  className="p-6 h-full"
                  tabIndex={-1}
                >
                  <CompanySettings
                    company={companyMemo}
                    onUpdate={handleUpdateCompany}
                    onDelete={handleDeleteCompany}
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
