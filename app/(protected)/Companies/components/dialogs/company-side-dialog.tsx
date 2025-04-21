import { Company } from "../../lib/types";
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
  Share,
  ShieldCheck,
  FileText,
  ExternalLink,
  PencilIcon,
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
import { CompanyUsers } from "../company-users";
import { CompanyDrivers } from "../company-drivers";
import { CompanySettings } from "../company-settings";
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
  removeSubscriptionItem,
  getUpcomingInvoice,
  getStripePaymentHistory,
  getPaymentMethods,
  updateSubscriptionStatus,
  getInvoices,
  setDefaultPaymentMethod,
} from "../../actions/stripe-actions";
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
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
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

type Status = "active" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "trialing" | "paused" | "canceling";

interface StripeSubscription {
  id: string;
  status: Status;
  current_period_start: number;
  current_period_end: number;
  cancel_at?: number;
  cancel_at_period_end?: boolean;
  pause_collection?: {
    resumes_at?: number;
  };
  items?: {
    data: Array<{
      id: string;
      price: {
        id: string;
        nickname?: string;
        unit_amount?: number;
        product?: {
          name?: string;
        };
        recurring?: {
          interval?: string;
        };
      };
      quantity?: number;
    }>;
  };
  plan?: {
    id: string;
    nickname: string | null;
    product: string | { name?: string; id?: string } | null;
  };
}

interface StripeData {
  customer?: any;
  subscription?: StripeSubscription | null;
  subscriptionItems?: any[];
  paymentMethod?: any;
  invoices?: any[];
  totalAmount?: number;
  nextBillingDate?: string;
  nextInvoiceAmount?: number;
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
  const [stripeData, setStripeData] = useState<StripeData | null>(null);
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
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Update local company state when initialCompany changes
  if (initialCompany?.id !== company?.id) {
    setCompany(initialCompany);
  }

  // State to track if we've already attempted to load Stripe data
  const [stripeLoadAttempted, setStripeLoadAttempted] = useState(false);

  // Process Stripe data after it's loaded
  useEffect(() => {
    if (open && company?.stripe_customer_id && !stripeLoadAttempted) {
      setStripeLoadAttempted(true);

      Promise.allSettled([
        loadStripeData(),
        loadAvailablePlans(),
        loadPaymentMethods(),
        loadInvoices(),
      ]).then((results) => {
        const allFailed = results.every(
          (result) => result.status === "rejected"
        );

        if (allFailed) {
          toast({
            title: "Connection Error",
            description:
              "Could not connect to Stripe. Please check your internet connection.",
            variant: "destructive",
            action: (
              <ToastAction
                altText="Retry"
                onClick={() => {
                  setStripeLoadAttempted(false);
                }}
              >
                Retry
              </ToastAction>
            ),
          });
        }
      });
    }
  }, [open, company?.id, stripeLoadAttempted]);

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

      if (!company.stripe_customer_id) {
        setStripeData({
          customer: null,
          subscription: null,
          subscriptionItems: [],
          paymentMethod: null,
          invoices: [],
          totalAmount: 0,
          nextBillingDate: "",
          nextInvoiceAmount: 0,
        });
        toast({
          title: "Info",
          description: "This company is not connected to Stripe yet",
        });
        return;
      }

      const data = await getStripeSubscriptionDetails(company.id);

      // Transform the subscription data to properly handle all states
      if (data?.subscription) {
        const subscriptionData = data.subscription as StripeSubscription;
        const status = subscriptionData.pause_collection
          ? "paused"
          : subscriptionData.cancel_at_period_end
            ? "canceling"
            : subscriptionData.status;

        // Transform the subscription items data
        const items = subscriptionData.items?.data?.map((item: any) => ({
          ...item,
          price: {
            ...item.price,
            formatted_amount: formatCurrency(item.price?.unit_amount || 0),
            recurring_formatted: item.price?.recurring
              ? `${formatCurrency(item.price.unit_amount || 0)}/${
                  item.price.recurring.interval
                }`
              : null,
          },
        }));

        data.subscription = {
          ...subscriptionData,
          status,
          items: {
            ...subscriptionData.items,
            data: items,
          },
          formatted_dates: {
            current_period_start: subscriptionData.current_period_start
              ? format(
                  new Date(subscriptionData.current_period_start * 1000),
                  "PP"
                )
              : null,
            current_period_end: subscriptionData.current_period_end
              ? format(
                  new Date(subscriptionData.current_period_end * 1000),
                  "PP"
                )
              : null,
            cancel_at: subscriptionData.cancel_at
              ? format(new Date(subscriptionData.cancel_at * 1000), "PP")
              : null,
            resume_at: subscriptionData.pause_collection?.resumes_at
              ? format(
                  new Date(subscriptionData.pause_collection.resumes_at * 1000),
                  "PP"
                )
              : null,
          },
        };
      }

      setStripeData(data as StripeData);
      return data;
    } catch (error: any) {
      console.error("Error loading Stripe data:", error);

      // Provide more specific error messages based on the error
      let errorMessage = "Failed to load subscription details";
      let variant: "default" | "destructive" = "destructive";

      if (
        error.type === "StripeConnectionError" ||
        (error.detail && error.detail.code === "ENOTFOUND")
      ) {
        errorMessage =
          "Could not connect to Stripe API. Please check your internet connection.";
      } else if (
        error.message?.includes("No such customer") ||
        error.message?.includes("Stripe customer has been deleted")
      ) {
        errorMessage =
          "Stripe customer not found. The customer may have been deleted.";

        // Update the company in the UI to reflect that it's no longer connected to Stripe
        if (company) {
          onUpdate(company.id, {
            stripe_customer_id: null,
            stripe_subscription_id: null,
            stripe_payment_method_id: null,
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
          <ToastAction
            altText="Retry"
            onClick={() => {
              setStripeLoadAttempted(false);
              loadStripeData();
            }}
          >
            Retry
          </ToastAction>
        ),
      });

      // Set stripe data to null to prevent UI from trying to render invalid data
      setStripeData(null);
      throw error; // Re-throw for Promise.allSettled
    } finally {
      setIsLoadingStripe(false);
    }
  };

  const loadAvailablePlans = async () => {
    try {
      const { plans } = await getAvailablePlans();
      setAvailablePlans(plans);
      return plans; // Return plans for Promise.allSettled
    } catch (error: any) {
      console.error("Error loading available plans:", error);

      let errorMessage = "Failed to load available plans";

      if (
        error.type === "StripeConnectionError" ||
        (error.detail && error.detail.code === "ENOTFOUND")
      ) {
        errorMessage =
          "Could not connect to Stripe API. Please check your internet connection.";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      throw error; // Re-throw for Promise.allSettled
    }
  };

  const loadPaymentMethods = async () => {
    if (!company?.stripe_customer_id) return;

    try {
      setIsLoadingPaymentMethods(true);
      const methods = await getPaymentMethods(company.stripe_customer_id);
      setPaymentMethods(methods);
    } catch (error) {
      console.error("Error loading payment methods:", error);
      toast({
        title: "Error",
        description: "Failed to load payment methods",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  };

  const loadInvoices = async () => {
    if (!company?.stripe_customer_id) return;

    try {
      setIsLoadingInvoices(true);
      const invoicesList = await getInvoices(company.stripe_customer_id);
      setInvoices(invoicesList);
    } catch (error) {
      console.error("Error loading invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setIsLoadingInvoices(false);
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

  // Add this helper function to check if a plan is already in the subscription
  const isPlanInSubscription = (planId: string) => {
    if (!stripeData?.subscriptionItems || !planId) return false;
    return stripeData.subscriptionItems.some(
      (item: any) => item.price.id === planId
    );
  };

  const handleAddSubscriptionItem = async () => {
    try {
      // Check if an item with the same plan already exists in the subscription
      if (isPlanInSubscription(newItemPlanId)) {
        toast({
          title: "Error",
          description:
            "This plan is already added to the subscription. You cannot add the same plan twice.",
          variant: "destructive",
        });
        return;
      }

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

      // Refresh subscription data and available plans
      await Promise.all([loadStripeData(), loadAvailablePlans()]);

      setAddItemDialogOpen(false);
      setNewItemQuantity(1);
      setNewItemPlanId("");
      toast({
        title: "Success",
        description: "Subscription item added successfully",
      });
    } catch (error: any) {
      console.error("Error adding subscription item:", error);

      // Extract the error message
      let errorMessage = "Failed to add subscription item";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === "object") {
        // Handle potential JSON response error
        if (error.message) {
          errorMessage = error.message;
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Close the dialog if it's a duplicate item error
      if (errorMessage.includes("already added to the subscription")) {
        setAddItemDialogOpen(false);

        // Refresh data to ensure UI is in sync
        await Promise.all([loadStripeData(), loadAvailablePlans()]).catch((e) =>
          console.error("Error refreshing data after error:", e)
        );
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveSubscriptionItem = async (item: any) => {
    try {
      setIsUpdating(true);
      await removeSubscriptionItem({
        subscriptionId: stripeData.subscription.id,
        itemId: item.id,
      });

      // Refresh subscription data and available plans
      await Promise.all([loadStripeData(), loadAvailablePlans()]);

      toast({
        title: "Success",
        description: "Subscription item removed successfully",
      });
    } catch (error: any) {
      console.error("Error removing subscription item:", error);

      // Extract the error message
      let errorMessage = "Failed to remove subscription item";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === "object") {
        // Handle potential JSON response error
        if (error.message) {
          errorMessage = error.message;
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
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

  // Add this function to handle opening the add item dialog
  const handleOpenAddItemDialog = () => {
    // Check if there are any available plans that aren't already in the subscription
    const availablePlansNotInSubscription = availablePlans.filter(
      (plan: any) => !isPlanInSubscription(plan.id)
    );

    if (availablePlansNotInSubscription.length === 0) {
      toast({
        title: "Info",
        description:
          "All available plans are already added to this subscription",
      });
      return;
    }

    // Reset the form values
    setNewItemPlanId("");
    setNewItemQuantity(1);
    setAddItemDialogOpen(true);
  };

  type SubscriptionAction =
    | "update"
    | "resume"
    | "share_link"
    | "exclude_auto_cancel"
    | "create_invoice"
    | "dont_cancel"
    | "reschedule_cancel"
    | "cancel_now"
    | "pause"
    | "cancel";

  const handleSubscriptionAction = async (action: SubscriptionAction) => {
    const subscriptionId = stripeData?.subscription?.id;
    if (!subscriptionId) {
      toast({
        title: "Error",
        description: "No active subscription found",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdating(true);
      
      const result = await updateSubscriptionStatus(subscriptionId, action);
      
      // Handle special cases
      if (action === "share_link" && result.url) {
        // Open the payment link in a new window
        window.open(result.url, "_blank");
      }
      
      // Reset cache and reload data
      setStripeLoadAttempted(false);
      await Promise.all([
        loadStripeData(),
        loadAvailablePlans(),
        loadPaymentMethods(),
        loadInvoices(),
      ]);

      toast({
        title: "Success",
        description: `Subscription ${action.replace(/_/g, " ")} successful`,
      });
    } catch (error) {
      console.error(`Error performing subscription action ${action}:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action.replace(/_/g, " ")} subscription`,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetDefaultPaymentMethod = async (paymentMethodId: string) => {
    if (!company?.stripe_customer_id) return;

    try {
      setIsUpdating(true);
      await setDefaultPaymentMethod(
        company.stripe_customer_id,
        paymentMethodId
      );
      await loadPaymentMethods();
      toast({
        title: "Success",
        description: "Default payment method updated",
      });
    } catch (error) {
      console.error("Error setting default payment method:", error);
      toast({
        title: "Error",
        description: "Failed to update default payment method",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {company?.name || "Company Details"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 hidden sm:block" />
              Details
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4 hidden sm:block" />
              Users
            </TabsTrigger>
            <TabsTrigger value="drivers" className="flex items-center gap-2">
              <Truck className="w-4 h-4 hidden sm:block" />
              Drivers
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Receipt className="w-4 h-4 hidden sm:block" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <ScrollArea className="h-[calc(80vh-200px)]">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Company Information</h3>
                    <p className="text-sm text-muted-foreground">
                      Basic details about the company
                    </p>
                  </div>
                  <Badge
                    variant={
                      company?.status === "active" ? "success" : "destructive"
                    }
                  >
                    {company?.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <h4 className="font-medium">Name</h4>
                    <p className="text-sm">{company?.name}</p>
                  </div>
                  <div className="grid gap-2">
                    <h4 className="font-medium">Contact Email</h4>
                    <p className="text-sm">{company?.contact_email}</p>
                  </div>
                  <div className="grid gap-2">
                    <h4 className="font-medium">Contact Phone</h4>
                    <p className="text-sm">{company?.contact_phone}</p>
                  </div>
                  <div className="grid gap-2">
                    <h4 className="font-medium">Contact Name</h4>
                    <p className="text-sm">
                      {company?.contact_first_name} {company?.contact_last_name}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <h4 className="font-medium">Created At</h4>
                    <p className="text-sm">
                      {company?.created_at
                        ? format(new Date(company.created_at), "PPpp")
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <ScrollArea className="h-[calc(80vh-200px)]">
              {company && <CompanyUsers company={company} />}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="drivers" className="mt-4">
            <ScrollArea className="h-[calc(80vh-200px)]">
              {company && <CompanyDrivers company={company} />}
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="payments"
            className="space-y-6 pb-6"
          >
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Payment Management</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStripeLoadAttempted(false);
                      Promise.all([
                        loadStripeData(),
                        loadAvailablePlans(),
                        loadPaymentMethods(),
                        loadInvoices(),
                      ]);
                    }}
                    disabled={isLoadingStripe}
                  >
                    <RefreshCw className={cn("mr-2 h-4 w-4", isLoadingStripe && "animate-spin")} />
                    Refresh
                  </Button>
                </div>
                <CardDescription>
                  Manage subscriptions, payment methods, and billing history
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {isLoadingStripe ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !company?.stripe_customer_id ? (
                  <div className="px-6 py-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">
                      Connect to Stripe
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto mb-4">
                      This company is not connected to Stripe yet. Connect to enable payment management.
                    </p>
                    <Button
                      onClick={async () => {
                        if (!company) return;
                        try {
                          setIsUpdating(true);
                          await syncStripeCustomer(company.id);
                          await loadStripeData();
                          toast({
                            title: "Success",
                            description: "Connected to Stripe successfully",
                          });
                        } catch (error) {
                          console.error("Error connecting to Stripe:", error);
                          toast({
                            title: "Error",
                            description: "Failed to connect to Stripe",
                            variant: "destructive",
                          });
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Connect Stripe Account
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Quick Actions Card */}
                    <div className="px-6">
                      <div className="rounded-lg border bg-card p-4">
                        <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenAddItemDialog}
                            disabled={
                              isUpdating ||
                              stripeData?.subscription?.status === "canceled" ||
                              !stripeData?.subscription
                            }
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Subscription Item
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!stripeData?.customer?.id) return;
                              try {
                                const result = await updateSubscriptionStatus(
                                  stripeData?.subscription?.id || "",
                                  "share_link"
                                );
                                if (result.url) {
                                  window.open(result.url, "_blank");
                                }
                              } catch (error) {
                                console.error("Error creating portal session:", error);
                                toast({
                                  title: "Error",
                                  description: "Failed to open billing portal",
                                  variant: "destructive",
                                });
                              }
                            }}
                            disabled={!stripeData?.customer?.id}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Billing Portal
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!stripeData?.subscription?.id) return;
                              try {
                                await updateSubscriptionStatus(
                                  stripeData.subscription.id,
                                  "create_invoice"
                                );
                                await loadInvoices();
                                toast({
                                  title: "Success",
                                  description: "Invoice created successfully",
                                });
                              } catch (error) {
                                console.error("Error creating invoice:", error);
                                toast({
                                  title: "Error",
                                  description: "Failed to create invoice",
                                  variant: "destructive",
                                });
                              }
                            }}
                            disabled={!stripeData?.subscription?.id}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Create Invoice
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Subscription Card */}
                    {stripeData?.subscription ? (
                      <div className="px-6">
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-base">
                                  Subscription Status
                                </CardTitle>
                                <CardDescription>
                                  Manage your current subscription
                                </CardDescription>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Actions"
                                    )}
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[240px]">
                                  <DropdownMenuItem onClick={() => handleSubscriptionAction("update")}>
                                    <div className="flex items-center">
                                      <Settings className="w-4 h-4 mr-2" />
                                      <div>
                                        <p>Update subscription</p>
                                        <p className="text-xs text-muted-foreground">Modify subscription details</p>
                                      </div>
                                    </div>
                                  </DropdownMenuItem>
                                  
                                  {stripeData?.subscription?.pause_collection && (
                                    <DropdownMenuItem onClick={() => handleSubscriptionAction("resume")}>
                                      <div className="flex items-center">
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        <div>
                                          <p>Resume payment collection</p>
                                          <p className="text-xs text-muted-foreground">Restart billing immediately</p>
                                        </div>
                                      </div>
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem onClick={() => handleSubscriptionAction("share_link")}>
                                    <div className="flex items-center">
                                      <Share className="w-4 h-4 mr-2" />
                                      <div>
                                        <p>Share payment update link</p>
                                        <p className="text-xs text-muted-foreground">Send update payment link</p>
                                      </div>
                                    </div>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => handleSubscriptionAction("exclude_auto_cancel")}>
                                    <div className="flex items-center">
                                      <ShieldCheck className="w-4 h-4 mr-2" />
                                      <div>
                                        <p>Exclude from auto-cancellation</p>
                                        <p className="text-xs text-muted-foreground">Prevent automatic cancellation</p>
                                      </div>
                                    </div>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => handleSubscriptionAction("create_invoice")}>
                                    <div className="flex items-center">
                                      <FileText className="w-4 h-4 mr-2" />
                                      <div>
                                        <p>Create one-time invoice</p>
                                        <p className="text-xs text-muted-foreground">Generate additional invoice</p>
                                      </div>
                                    </div>
                                  </DropdownMenuItem>

                                  {stripeData?.subscription?.cancel_at_period_end && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleSubscriptionAction("dont_cancel")}>
                                        <div className="flex items-center">
                                          <CheckCircle className="w-4 h-4 mr-2" />
                                          <div>
                                            <p>Don't cancel</p>
                                            <p className="text-xs text-muted-foreground">Keep subscription active</p>
                                          </div>
                                        </div>
                                      </DropdownMenuItem>

                                      <DropdownMenuItem onClick={() => handleSubscriptionAction("reschedule_cancel")}>
                                        <div className="flex items-center">
                                          <CalendarClock className="w-4 h-4 mr-2" />
                                          <div>
                                            <p>Reschedule cancellation</p>
                                            <p className="text-xs text-muted-foreground">Change cancellation date</p>
                                          </div>
                                        </div>
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {!stripeData?.subscription?.cancel_at_period_end && 
                                   stripeData?.subscription?.status !== "canceled" && (
                                    <DropdownMenuItem 
                                      onClick={() => handleSubscriptionAction("cancel_now")}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <div className="flex items-center">
                                        <XCircle className="w-4 h-4 mr-2" />
                                        <div>
                                          <p>Cancel now...</p>
                                          <p className="text-xs">Cancel subscription immediately</p>
                                        </div>
                                      </div>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">Status</p>
                                  <div className="flex items-center">
                                    <Badge 
                                      variant={
                                        stripeData.subscription.status === "active" && !stripeData.subscription.pause_collection && !stripeData.subscription.cancel_at_period_end
                                          ? "success"
                                          : stripeData.subscription.pause_collection
                                          ? "warning"
                                          : stripeData.subscription.cancel_at_period_end
                                          ? "destructive"
                                          : "destructive"
                                      }
                                      className="mr-2"
                                    >
                                      {stripeData.subscription.pause_collection
                                        ? "Paused"
                                        : stripeData.subscription.cancel_at_period_end
                                        ? "Canceling"
                                        : stripeData.subscription.status === "active"
                                        ? "Active"
                                        : stripeData.subscription.status}
                                    </Badge>
                                    
                                    {/* Status details */}
                                    {stripeData.subscription.pause_collection && stripeData.subscription.pause_collection.resumes_at && (
                                      <span className="text-xs text-muted-foreground">
                                        Resumes on {format(new Date(stripeData.subscription.pause_collection.resumes_at * 1000), "PP")}
                                      </span>
                                    )}
                                    
                                    {stripeData.subscription.cancel_at_period_end && (
                                      <span className="text-xs text-muted-foreground">
                                        Cancels on {format(new Date(stripeData.subscription.current_period_end * 1000), "PP")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right space-y-1">
                                  <p className="text-sm font-medium">Current period</p>
                                  <p className="text-sm text-muted-foreground">
                                    {stripeData.subscription.current_period_start &&
                                      format(
                                        new Date(
                                          stripeData.subscription.current_period_start * 1000
                                        ),
                                        "PP"
                                      )}{" "}
                                      -{" "}
                                      {stripeData.subscription.current_period_end &&
                                        format(
                                          new Date(
                                            stripeData.subscription.current_period_end * 1000
                                          ),
                                          "PP"
                                        )}
                                  </p>
                                </div>
                              </div>

                              {/* Subscription ID */}
                              <div className="flex items-center justify-between border-t pt-4">
                                <p className="text-sm font-medium">Subscription ID</p>
                                <p className="text-sm font-mono">{stripeData.subscription.id}</p>
                              </div>

                              {/* Billing Details */}
                              <div className="flex items-center justify-between border-t pt-4">
                                <p className="text-sm font-medium">Next billing amount</p>
                                <p className="text-sm font-medium">
                                  {formatCurrency(stripeData.nextInvoiceAmount || 0)}
                                </p>
                              </div>

                              {/* Items Count */}
                              <div className="flex items-center justify-between border-t pt-4">
                                <p className="text-sm font-medium">Subscription items</p>
                                <p className="text-sm">
                                  {stripeData.subscription.items?.data?.length || 0} items
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="px-6 py-4 text-center">
                        <p className="text-muted-foreground">
                          No active subscription found. Create a subscription to enable billing.
                        </p>
                        <Button 
                          className="mt-4" 
                          onClick={handleOpenAddItemDialog}
                          disabled={!stripeData?.customer?.id}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create Subscription
                        </Button>
                      </div>
                    )}

                    {/* Active Subscription Items */}
                    {stripeData?.subscription?.items?.data && 
                     stripeData.subscription.items.data.length > 0 && (
                      <div className="px-6">
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <CardTitle className="text-base">
                                  Subscription Items
                                </CardTitle>
                                <CardDescription>
                                  Current subscription items and pricing
                                </CardDescription>
                              </div>
                              <div>
                                <Input
                                  placeholder="Search items..."
                                  className="w-[200px]"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[40%]">Item</TableHead>
                                  <TableHead className="text-right">Quantity</TableHead>
                                  <TableHead className="text-right">Unit Price</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortAndFilterItems(stripeData.subscription.items.data).map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                      <div>
                                        <p>{item.price?.product?.name || item.price?.nickname || "Unnamed plan"}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {item.price?.recurring
                                            ? `Billed ${item.price.recurring.interval}ly`
                                            : "One-time"}
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">{item.quantity || 1}</TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency((item.price?.unit_amount || 0) / 100)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(((item.price?.unit_amount || 0) * (item.quantity || 1)) / 100)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleEditItem(item)}
                                          disabled={
                                            isUpdating ||
                                            stripeData.subscription.status === "canceled" ||
                                            stripeData.subscription.pause_collection ||
                                            stripeData.subscription.cancel_at_period_end
                                          }
                                          title="Edit item"
                                        >
                                          <PencilIcon className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleRemoveSubscriptionItem(item)}
                                          disabled={
                                            isUpdating ||
                                            stripeData.subscription.status === "canceled" ||
                                            stripeData.subscription.pause_collection ||
                                            stripeData.subscription.cancel_at_period_end ||
                                            (stripeData.subscription.items?.data?.length <= 1)
                                          }
                                          className="text-destructive"
                                          title="Remove item"
                                        >
                                          <Trash className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Payment Methods */}
                    {paymentMethods.length > 0 && (
                      <div className="px-6">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Payment Methods</CardTitle>
                            <CardDescription>
                              Cards and other payment methods for this customer
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {paymentMethods.map((method) => (
                              <div
                                key={method.id}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg border",
                                  method.isDefault && "bg-muted"
                                )}
                              >
                                <div className="flex items-center space-x-4">
                                  <div className="bg-background p-2 rounded-md">
                                    <CreditCard className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">
                                      •••• {method.card.last4}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Expires {method.card.exp_month}/{method.card.exp_year}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {method.isDefault ? (
                                    <Badge variant="outline" className="bg-muted">
                                      Default
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSetDefaultPaymentMethod(method.id)}
                                      disabled={isUpdating}
                                    >
                                      Set Default
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Billing History */}
                    {invoices.length > 0 && (
                      <div className="px-6">
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <CardTitle className="text-base">Billing History</CardTitle>
                                <CardDescription>
                                  Recent invoices and payment history
                                </CardDescription>
                              </div>
                              <div>
                                <Input
                                  placeholder="Search invoices..."
                                  className="w-[200px]"
                                  value={invoiceSearchTerm}
                                  onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Invoice</TableHead>
                                  <TableHead 
                                    className="cursor-pointer"
                                    onClick={() => handleInvoiceSort("date")}
                                  >
                                    Date
                                    {invoiceSortField === "date" && (
                                      <ChevronUp
                                        className={cn(
                                          "ml-1 h-4 w-4 inline",
                                          invoiceSortDirection === "desc" && "rotate-180"
                                        )}
                                      />
                                    )}
                                  </TableHead>
                                  <TableHead 
                                    className="cursor-pointer"
                                    onClick={() => handleInvoiceSort("amount")}
                                  >
                                    Amount
                                    {invoiceSortField === "amount" && (
                                      <ChevronUp
                                        className={cn(
                                          "ml-1 h-4 w-4 inline",
                                          invoiceSortDirection === "desc" && "rotate-180"
                                        )}
                                      />
                                    )}
                                  </TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortAndFilterInvoices(invoices).map((invoice) => (
                                  <TableRow key={invoice.id}>
                                    <TableCell className="font-medium">
                                      {invoice.number}
                                    </TableCell>
                                    <TableCell>
                                      {formatDate(invoice.created)}
                                    </TableCell>
                                    <TableCell>
                                      {formatCurrency(invoice.total / 100)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={
                                          invoice.status === "paid"
                                            ? "success"
                                            : invoice.status === "open"
                                            ? "outline"
                                            : "secondary"
                                        }
                                      >
                                        {invoice.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        asChild
                                      >
                                        <a
                                          href={invoice.hosted_invoice_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <ExternalLink className="mr-2 h-4 w-4" />
                                          View
                                        </a>
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
