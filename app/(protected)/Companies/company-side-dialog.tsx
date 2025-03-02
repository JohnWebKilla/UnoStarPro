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
import { useState, useEffect } from "react";
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
  const [company, setCompany] = useState<Company | undefined>(initialCompany);
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

  // Update local company state when initialCompany changes
  if (initialCompany?.id !== company?.id) {
    setCompany(initialCompany);
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

  if (!company) return null;

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

      // Immediately update local state
      setCompany((prev) => (prev ? { ...prev, ...data } : prev));

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
      // Revert local state on error
      setCompany(initialCompany);

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
    if (!onDelete) return;

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
      <SheetContent
        className="w-[1000px] sm:max-w-[1000px] p-0 overflow-hidden flex flex-col h-full"
        side="right"
      >
        {/* Fixed Header Section */}
        <div className="border-b p-6 bg-background">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <SheetTitle className="text-2xl font-semibold">
                  {company.name}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  ID: {company.id} • Created {formatDate(company.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] pl-3 pr-2 justify-between font-medium",
                        company.status === "active"
                          ? statusStyles.active.button
                          : statusStyles.inactive.button
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {company.status === "active" ? (
                          <CheckCircle
                            className={cn("h-4 w-4", statusStyles.active.icon)}
                          />
                        ) : (
                          <XCircle
                            className={cn(
                              "h-4 w-4",
                              statusStyles.inactive.icon
                            )}
                          />
                        )}
                        <span className="capitalize">{company.status}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[140px]">
                    <DropdownMenuItem
                      className={cn(
                        "flex items-center gap-2",
                        company.status === "active"
                          ? "cursor-not-allowed opacity-50"
                          : statusStyles.active.dropdown
                      )}
                      disabled={company.status === "active" || isUpdating}
                      onClick={() => handleUpdateCompany({ status: "active" })}
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Active</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn(
                        "flex items-center gap-2",
                        company.status === "inactive"
                          ? "cursor-not-allowed opacity-50"
                          : statusStyles.inactive.dropdown
                      )}
                      disabled={company.status === "inactive" || isUpdating}
                      onClick={() =>
                        handleUpdateCompany({ status: "inactive" })
                      }
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Inactive</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {company.stripe_customer_id && (
                  <Badge variant="outline" className="h-6 px-3">
                    <CreditCard className="mr-1 h-3 w-3" />
                    Connected to Stripe
                  </Badge>
                )}
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Tabs Navigation */}
        <Tabs
          defaultValue="details"
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Tabs Header */}
          <div className="border-b bg-background">
            <TabsList className="flex h-12 items-center gap-4 w-full justify-start px-6">
              <TabsTrigger
                value="details"
                className="gap-2 data-[state=active]:bg-background"
              >
                <Building2 className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="gap-2 data-[state=active]:bg-background"
              >
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger
                value="drivers"
                className="gap-2 data-[state=active]:bg-background"
              >
                <Truck className="h-4 w-4" />
                Drivers
              </TabsTrigger>
              <TabsTrigger
                value="payments"
                className="gap-2 data-[state=active]:bg-background"
              >
                <CreditCard className="h-4 w-4" />
                Payments
              </TabsTrigger>
              <TabsTrigger
                value="subscriptions"
                className="gap-2 data-[state=active]:bg-background"
              >
                <Receipt className="h-4 w-4" />
                Subscriptions
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="gap-2 data-[state=active]:bg-background"
              >
                <Receipt className="h-4 w-4" />
                Invoices
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="gap-2 data-[state=active]:bg-background"
              >
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <TabsContent value="details" className="mt-0">
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
                            {company.contact_first_name}{" "}
                            {company.contact_last_name}
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
                          <p className="text-sm text-muted-foreground">
                            Created
                          </p>
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

              <TabsContent value="users" className="mt-0">
                <div className="p-6">
                  <CompanyUsers company={company} />
                </div>
              </TabsContent>

              <TabsContent value="drivers" className="mt-0">
                <div className="p-6">
                  <CompanyDrivers company={company} />
                </div>
              </TabsContent>

              <TabsContent value="payments" className="mt-0">
                <div className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Payment Methods</h3>
                      <Button size="sm">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Add Payment Method
                      </Button>
                    </div>
                    {company.stripe_payment_method_id ? (
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <CreditCard className="h-6 w-6" />
                            <div>
                              <p className="font-medium">•••• 4242</p>
                              <p className="text-sm text-muted-foreground">
                                Expires 12/25
                              </p>
                            </div>
                          </div>
                          <Badge>Default</Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-8 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                          <CreditCard className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium mb-1">No Payment Methods</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add a payment method to process payments
                        </p>
                        <Button size="sm">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Add Payment Method
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="subscriptions" className="mt-0">
                <div className="p-6">
                  <div className="space-y-8">
                    {/* Current Subscription Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium">
                          Current Subscription
                        </h3>
                        <Button size="sm" disabled={isLoadingStripe}>
                          <Receipt className="h-4 w-4 mr-2" />
                          Change Plan
                        </Button>
                      </div>
                      {isLoadingStripe ? (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : (
                        <div className="rounded-lg border">
                          <div className="p-6 space-y-4">
                            <div className="rounded-lg border bg-card text-card-foreground">
                              <div className="p-6 space-y-4">
                                <h3 className="text-lg font-medium">
                                  Subscription Plan
                                </h3>
                                <div className="space-y-2">
                                  <div className="text-2xl font-bold">
                                    {formatCurrency(
                                      stripeData?.totalAmount || 0
                                    )}{" "}
                                    / month
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {stripeData?.subscriptionItems?.length || 0}{" "}
                                    active subscription items
                                  </div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <span className="flex items-center">
                                      Next billing on{" "}
                                      {formatDate(
                                        stripeData?.nextBillingDate || ""
                                      )}{" "}
                                      •{" "}
                                      {formatCurrency(
                                        stripeData?.nextInvoiceAmount || 0
                                      )}
                                    </span>
                                    <Badge variant="outline">
                                      {stripeData?.subscription?.status ||
                                        "Inactive"}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Subscription Items Table */}
                    {stripeData?.subscriptionItems?.length > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Subscription Items</h4>
                          <Button
                            size="sm"
                            onClick={() => setAddItemDialogOpen(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        </div>
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {stripeData.subscriptionItems.map((item: any) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    {item.price.product.name}
                                  </TableCell>
                                  <TableCell>
                                    {item.quantity || "Unlimited"}
                                  </TableCell>
                                  <TableCell>
                                    {formatCurrency(item.price.unit_amount)}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditItem(item)}
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="invoices" className="mt-0">
                <div className="p-6">
                  <div className="space-y-8">
                    <h3 className="text-lg font-medium mb-4">Invoices</h3>
                    {paginatedInvoices.length > 0 ? (
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead
                                onClick={() => handleInvoiceSort("date")}
                              >
                                Date
                              </TableHead>
                              <TableHead
                                onClick={() => handleInvoiceSort("amount")}
                              >
                                Amount
                              </TableHead>
                              <TableHead
                                onClick={() => handleInvoiceSort("status")}
                              >
                                Status
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedInvoices.map((invoice: any) => (
                              <TableRow key={invoice.id}>
                                <TableCell>
                                  {formatDate(invoice.created)}
                                </TableCell>
                                <TableCell>
                                  {formatCurrency(invoice.amount_due)}
                                </TableCell>
                                <TableCell>{invoice.status}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex justify-between items-center mt-4">
                          <Button
                            size="sm"
                            disabled={invoicePage === 1}
                            onClick={() => setInvoicePage(invoicePage - 1)}
                          >
                            Previous
                          </Button>
                          <span>
                            Page {invoicePage} of {totalInvoicePages}
                          </span>
                          <Button
                            size="sm"
                            disabled={invoicePage === totalInvoicePages}
                            onClick={() => setInvoicePage(invoicePage + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No invoices found.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <div className="p-6">
                  <CompanySettings
                    company={company}
                    onUpdate={handleUpdateCompany}
                    onDelete={handleDeleteCompany}
                  />
                </div>
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
