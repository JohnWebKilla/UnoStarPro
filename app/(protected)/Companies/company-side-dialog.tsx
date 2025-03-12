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

  // Use useMemo to create a stable reference to the company
  const company = useMemo(() => {
    if (!initialCompany) return null;
    return initialCompany;
  }, [initialCompany]);

  // Early return if no company is provided
  if (!company) {
    return null;
  }

  useEffect(() => {
    if (open && company?.stripe_customer_id) {
      loadStripeData();
      loadAvailablePlans();
    }
  }, [open, company?.id]);

  const loadStripeData = async () => {
    try {
      setIsLoadingStripe(true);
      const data = await getStripeSubscriptionDetails(company!.id);
      setStripeData(data);
    } catch (error) {
      console.error("Error loading Stripe data:", error);
      toast({
        title: "Error",
        description: "Failed to load subscription details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStripe(false);
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
        body: JSON.stringify({ companyId: company.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to Stripe");
      }

      // Refresh the company data after connecting to Stripe
      await onUpdate(company.id, { stripe_customer_id: await response.text() });
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
      await onUpdate(company.id, data);

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
    if (!company || !onDelete) return;

    try {
      setIsUpdating(true);
      const loadingToast = toast({
        title: "Deleting company...",
        description: "Please wait while we process your request.",
      });

      await onDelete(company.id);
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold">
            {company.name || "Company Details"}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-6">
          <TabsList className="grid grid-cols-5 gap-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="drivers" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Drivers
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="p-6">
              <div className="space-y-8">
                {/* Company Information Section */}
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Company Information
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Contact Person
                      </p>
                      <p className="text-sm font-medium">
                        {company.contact_first_name} {company.contact_last_name}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Contact Details
                      </p>
                      <p className="text-sm font-medium">
                        {company.contact_email}
                      </p>
                      <p className="text-sm font-medium">
                        {company.contact_phone}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Created</p>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {formatDate(company.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Last Updated
                      </p>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {formatDate(company.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Driver Statistics Section */}
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Driver Statistics
                  </h3>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Total Drivers
                        </p>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-2xl font-bold">24</p>
                    </div>
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Active Drivers
                        </p>
                        <Badge variant="default" className="bg-emerald-500">
                          18
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <p className="text-sm">Currently on duty</p>
                      </div>
                    </div>
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Inactive Drivers
                        </p>
                        <Badge variant="secondary">6</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">Off duty</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="p-6">
              <CompanyUsers company={company} />
            </div>
          </TabsContent>

          <TabsContent value="billing">
            <div className="space-y-6">
              {company.stripe_customer_id ? (
                <StripeTabs company={company} />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                  <CreditCard className="h-12 w-12 text-gray-400" />
                  <h3 className="text-lg font-semibold">No Billing Setup</h3>
                  <p className="text-sm text-gray-500 text-center">
                    This company hasn't been connected to Stripe yet. Connect to
                    manage payments, subscriptions, and invoices.
                  </p>
                  <Button
                    onClick={handleConnectStripe}
                    disabled={isLoadingStripe}
                  >
                    {isLoadingStripe ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Connect to Stripe"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="drivers">
            <div className="p-6">
              <CompanyDrivers company={company} />
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="p-6">
              <CompanySettings
                company={company}
                onUpdate={handleUpdateCompany}
                onDelete={handleDeleteCompany}
              />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
