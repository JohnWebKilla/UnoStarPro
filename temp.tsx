import { Company } from "./lib/types";
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
  RefreshCw,
  Trash,
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
import { CompanyUsers } from "./app/(protected)/Companies/components/company-users";
import { CompanyDrivers } from "./app/(protected)/Companies/components/company-drivers";
import { CompanySettings } from "./app/(protected)/Companies/components/company-settings";
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
  cancelSubscription,
  syncStripeCustomer,
} from "./app/(protected)/Companies/stripe-actions";
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
import { ToastAction } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Stripe,
  StripeElementsOptions,
  StripePaymentElementOptions,
} from "@stripe/stripe-js";

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

  // Process Stripe data after it's loaded
  useEffect(() => {
    if (stripeData && stripeData.subscription) {
      const updateStripeData = async () => {
        // Get next billing date from subscription
        const nextBillingDate = stripeData.subscription.current_period_end
          ? new Date(
              stripeData.subscription.current_period_end * 1000
            ).toISOString()
          : "";

        // Calculate total amount from subscription items
        const totalAmount = stripeData.subscriptionItems.reduce(
          (sum: number, item: any) =>
            sum + (item.price.unit_amount * item.quantity || 0),
          0
        );

        // Update the stripeData with the real values
        setStripeData((prev: any) => ({
          ...prev,
          nextBillingDate,
          totalAmount,
        }));
      };

      updateStripeData();
    }
  }, [stripeData?.subscription?.id]);

  useEffect(() => {
    if (open && company?.stripe_customer_id) {
      loadStripeData();
      loadAvailablePlans();
    }
  }, [open, company?.id]);

  const loadStripeData = async () => {
    if (!company || !company.id) {
      toast({
        title: "Error",
        description: "Company information is missing",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoadingStripe(true);

      // Check if company has a Stripe customer ID before trying to load data
      if (!company.stripe_customer_id) {
        setStripeData(null);
        toast({
          title: "Info",
          description: "This company is not connected to Stripe yet",
        });
        return;
      }

      const data = await getStripeSubscriptionDetails(company.id);
      setStripeData(data);
    } catch (error: any) {
      console.error("Error loading Stripe data:", error);

      // Provide more specific error messages based on the error
      let errorMessage = "Failed to load subscription details";
      let variant: "default" | "destructive" = "destructive";

      if (
        error.message?.includes("No such customer") ||
        error.message?.includes("Stripe customer has been deleted")
      ) {
        errorMessage =
          "Stripe customer not found. The customer may have been deleted.";

        // Update the company in the UI to reflect that it's no longer connected to Stripe
        if (company) {
          onUpdate(company.id, {
            stripe_customer_id: undefined,
            stripe_subscription_id: undefined,
            stripe_payment_method_id: undefined,
          });
        }
      } else if (error.message?.includes("Invalid customer object")) {
        errorMessage =
          "Invalid Stripe customer data. The customer information may be corrupted.";
      } else if (error.message?.includes("not connected to Stripe")) {
        errorMessage = "This company is not connected to Stripe yet.";
        variant = "default";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant,
        action: (
          <ToastAction altText="Retry" onClick={() => loadStripeData()}>
            Retry
          </ToastAction>
        ),
      });

      // Set stripe data to null to prevent UI from trying to render invalid data
      setStripeData(null);
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

  const handleRemoveSubscriptionItem = async (item: any) => {
    if (!company?.id || !stripeData?.subscription?.id) return;

    const subscriptionId: string = stripeData.subscription.id;

    try {
      setIsUpdating(true);
      await cancelSubscription(subscriptionId);
      await loadStripeData(); // Refresh the data
      toast({
        title: "Success",
        description: "Subscription item removed successfully",
      });
    } catch (error: any) {
      console.error("Error removing subscription item:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove subscription item",
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

  const formatDate = (date: string | undefined) => {
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
    <>
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
                              className={cn(
                                "h-4 w-4",
                                statusStyles.active.icon
                              )}
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
                        onClick={() =>
                          handleUpdateCompany({ status: "active" })
                        }
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
                <TabsContent value="subscriptions" className="mt-0">
                  <div className="p-6">
                    <div className="space-y-8">
                      {/* Current Subscription Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium">
                            Current Subscription
                          </h3>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={loadStripeData}
                              disabled={isLoadingStripe}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Refresh
                            </Button>
                          </div>
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
                                  <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                      <div className="text-sm text-muted-foreground">
                                        Current Plan Price
                                      </div>
                                      <div className="text-2xl font-bold">
                                        {formatCurrency(
                                          stripeData?.totalAmount || 0
                                        )}{" "}
                                        / month
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <div className="text-sm text-muted-foreground">
                                        Next Invoice
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-base font-medium">
                                          {formatDate(
                                            stripeData?.nextBillingDate || ""
                                          )}
                                        </div>
                                        <Badge variant="outline">
                                          {formatCurrency(
                                            stripeData?.nextInvoiceAmount || 0
                                          )}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <div className="text-sm text-muted-foreground">
                                        {stripeData?.subscriptionItems
                                          ?.length || 0}{" "}
                                        active subscription items
                                      </div>
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

                      {/* Subscription Items Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium">
                            Subscription Items
                          </h3>
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
                              {stripeData?.subscriptionItems?.length > 0 ? (
                                stripeData.subscriptionItems.map(
                                  (item: any) => (
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
                                        <div className="flex items-center space-x-2 justify-end">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditItem(item)}
                                            title="Edit item"
                                          >
                                            <Settings className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleRemoveSubscriptionItem(item)
                                            }
                                            disabled={
                                              stripeData.subscriptionItems
                                                .length <= 1
                                            }
                                            title="Remove item"
                                          >
                                            <Trash className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )
                                )
                              ) : (
                                <TableRow>
                                  <TableCell
                                    colSpan={4}
                                    className="text-center text-muted-foreground"
                                  >
                                    No subscription items found
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Edit Subscription Item Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Subscription Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">
                Name
              </label>
              <div className="col-span-3">
                <Input
                  id="name"
                  value={editingItem?.price?.product?.name || ""}
                  disabled
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="quantity"
                className="text-right text-sm font-medium"
              >
                Quantity
              </label>
              <div className="col-span-3">
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newQuantity}
                  onChange={(e) =>
                    setNewQuantity(parseInt(e.target.value) || 1)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="plan" className="text-right text-sm font-medium">
                Plan
              </label>
              <div className="col-span-3">
                <Select
                  value={selectedPlanId}
                  onValueChange={setSelectedPlanId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan: any) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.product.name} - {formatCurrency(plan.unit_amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubscription} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subscription Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Subscription Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="plan" className="text-right text-sm font-medium">
                Plan
              </label>
              <div className="col-span-3">
                <Select value={newItemPlanId} onValueChange={setNewItemPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan: any) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.product.name} - {formatCurrency(plan.unit_amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor="quantity"
                className="text-right text-sm font-medium"
              >
                Quantity
              </label>
              <div className="col-span-3">
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newItemQuantity}
                  onChange={(e) =>
                    setNewItemQuantity(parseInt(e.target.value) || 1)
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddItemDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSubscriptionItem}
              disabled={isUpdating || !newItemPlanId}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
