"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Company } from "../types";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  syncStripeCustomer as getStripeSubscriptionDetails,
  getCompanyPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  createSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getAvailablePlans,
} from "../stripe-actions";
import { clearCompanyCache } from "../actions";
import { AddPaymentMethod } from "../components/add-payment-method";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  Receipt,
  Repeat,
  Star,
  Loader2,
  Trash,
  ChevronRight,
  Plus,
  MoreVertical,
  Pencil,
  Link,
  FileText,
  ShieldCheck,
  X,
  Eye,
  CalendarClock,
  AlertTriangle,
  Pause,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { subscriptionDetailsCache, CACHE_TTL } from "../cache";
import { Skeleton } from "@/components/ui/skeleton";

// Client-side cache
const paymentMethodsCache = new Map<
  number,
  { data: any[]; timestamp: number }
>();
// Use the shared cache instead of a local one
// const subscriptionDetailsCache = new Map<
//   number,
//   { data: any; timestamp: number }
// >();
// const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper function to format currency
const formatCurrency = (amount: number) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  return formatter.format(amount / 100);
};

interface StripeTabsProps {
  company: Company;
  preloadedData?: any;
  isLoading?: boolean;
  defaultTab?: string;
}

interface SubscriptionItem {
  priceId: string;
  quantity: number;
}

// Define our own interface for the invoice
interface Invoice {
  id: string;
  number: string | null;
  amount_due: number;
  status: string | null;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

interface CreateSubscriptionDialogProps {
  onSubscribe: (items: SubscriptionItem[]) => Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isProcessing: boolean;
}

function CreateSubscriptionDialog({
  onSubscribe,
  isOpen,
  onOpenChange,
  isProcessing,
}: CreateSubscriptionDialogProps) {
  const [subscriptionItems, setSubscriptionItems] = useState<
    SubscriptionItem[]
  >([{ priceId: "", quantity: 1 }]);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const plansRef = useRef<any[]>([]);
  const { toast } = useToast();

  // Check if a product is already selected in another item
  const isProductSelected = (productId: string, currentIndex: number) => {
    return subscriptionItems.some(
      (item, i) => i !== currentIndex && item.priceId === productId
    );
  };

  // Debug logs
  console.log("CreateSubscriptionDialog rendered with props:", {
    isOpen,
    isProcessing,
  });

  // Preload plans when component mounts, not just when dialog opens
  useEffect(() => {
    const preloadPlans = async () => {
      try {
        // Only fetch if we don't already have plans
        if (plansRef.current.length === 0) {
          const response = await fetch("/api/stripe/plans");
          const data = await response.json();

          if (data.plans) {
            plansRef.current = data.plans;
          }
        }
      } catch (error) {
        console.error("Error preloading plans:", error);
      }
    };

    preloadPlans();
  }, []);

  // Initialize subscription items when dialog opens
  useEffect(() => {
    console.log(
      "CreateSubscriptionDialog useEffect triggered, isOpen:",
      isOpen
    );

    const initializeDialog = async () => {
      if (!isOpen) return;

      console.log("Dialog is open, initializing...");
      try {
        setIsLoading(true);

        // If we already preloaded plans, use them
        if (plansRef.current.length > 0) {
          setAvailablePlans(plansRef.current);
          setIsLoading(false);
          return;
        }

        // Otherwise fetch plans
        const response = await fetch("/api/stripe/plans");
        const data = await response.json();

        if (data.plans) {
          setAvailablePlans(data.plans);
          plansRef.current = data.plans;
        } else {
          toast({
            title: "Error",
            description: "Failed to load subscription plans",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
        toast({
          title: "Error",
          description: "Failed to load subscription plans",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeDialog();
  }, [isOpen, toast]);

  const handleAddItem = () => {
    setSubscriptionItems([...subscriptionItems, { priceId: "", quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setSubscriptionItems(subscriptionItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof SubscriptionItem,
    value: string | number
  ) => {
    // If changing a priceId, check if it's already selected in another item
    if (field === "priceId" && typeof value === "string") {
      const isAlreadySelected = subscriptionItems.some(
        (item, i) => i !== index && item.priceId === value
      );

      if (isAlreadySelected) {
        toast({
          title: "Product already selected",
          description:
            "You've already added this product to your subscription.",
          variant: "destructive",
        });
        return;
      }
    }

    const newItems = [...subscriptionItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSubscriptionItems(newItems);
  };

  const handleSubscribe = async () => {
    const validItems = subscriptionItems.filter(
      (item) => item.priceId && item.quantity > 0
    );
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive",
      });
      return;
    }
    await onSubscribe(validItems);
    onOpenChange(false);
  };

  const calculateSubtotal = () => {
    return subscriptionItems.reduce((sum, item) => {
      const plan = availablePlans.find((p) => p.id === item.priceId);
      return sum + (plan ? (plan.unit_amount * item.quantity) / 100 : 0);
    }, 0);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        console.log("Dialog onOpenChange called with:", open);
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl">Create Subscription</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1">
            Select the products you want to subscribe to
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <span className="ml-3 text-lg">
              Loading subscription products...
            </span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="h-[350px] overflow-y-auto overflow-x-hidden pr-2 py-2 scrollbar scrollbar-thumb-rounded scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <div className="space-y-6 px-1">
                {subscriptionItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-4 items-center bg-muted/5 p-4 rounded-lg border"
                  >
                    <div className="col-span-12 md:col-span-6">
                      <Label
                        htmlFor={`plan-${index}`}
                        className="text-sm font-medium mb-1.5 block text-muted-foreground"
                      >
                        Select Product
                      </Label>
                      <Select
                        value={item.priceId}
                        onValueChange={(value) =>
                          handleItemChange(index, "priceId", value)
                        }
                      >
                        <SelectTrigger id={`plan-${index}`} className="w-full">
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePlans.map((plan) => (
                            <SelectItem
                              key={plan.id}
                              value={plan.id}
                              disabled={isProductSelected(plan.id, index)}
                              className={
                                isProductSelected(plan.id, index)
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }
                            >
                              {plan.product.name} -{" "}
                              {formatCurrency(plan.unit_amount)}
                              {isProductSelected(plan.id, index) &&
                                " (Already added)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-9 md:col-span-4">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor={`quantity-${index}`}
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Quantity
                        </Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "quantity",
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="col-span-3 md:col-span-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        disabled={subscriptionItems.length === 1}
                        className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full py-6 border-dashed"
                  onClick={handleAddItem}
                >
                  <Plus className="mr-2 h-5 w-5" /> Add Another Product
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 mt-4 space-y-3 bg-background">
              <div className="bg-muted/10 p-4 rounded-lg border space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(calculateSubtotal() * 100)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total excluding tax
                  </span>
                  <span className="font-medium">
                    {formatCurrency(calculateSubtotal() * 100)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/40">
                  <span>Total</span>
                  <span>{formatCurrency(calculateSubtotal() * 100)}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isProcessing}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubscribe}
                  disabled={
                    !subscriptionItems.some((item) => item.priceId) ||
                    isProcessing
                  }
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface UpdateSubscriptionDialogProps {
  subscription: any;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isProcessing: boolean;
  onUpdate: (items: SubscriptionItem[]) => Promise<void>;
}

function UpdateSubscriptionDialog({
  subscription,
  isOpen,
  onOpenChange,
  isProcessing,
  onUpdate,
}: UpdateSubscriptionDialogProps) {
  const [subscriptionItems, setSubscriptionItems] = useState<
    SubscriptionItem[]
  >([]);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const plansRef = useRef<any[]>([]);
  const { toast } = useToast();

  // Check if a product is already selected in another item
  const isProductSelected = (productId: string, currentIndex: number) => {
    return subscriptionItems.some(
      (item, i) => i !== currentIndex && item.priceId === productId
    );
  };

  // Preload plans when component mounts, not just when dialog opens
  useEffect(() => {
    const preloadPlans = async () => {
      try {
        // Only fetch if we don't already have plans
        if (plansRef.current.length === 0) {
          const response = await fetch("/api/stripe/plans");
          const data = await response.json();

          if (data.plans) {
            plansRef.current = data.plans;
          }
        }
      } catch (error) {
        console.error("Error preloading plans:", error);
      }
    };

    preloadPlans();
  }, []);

  // Initialize subscription items when dialog opens
  useEffect(() => {
    const initializeDialog = async () => {
      if (!isOpen) return;

      try {
        setIsLoading(true);

        // If we already preloaded plans, use them
        if (plansRef.current.length > 0) {
          setAvailablePlans(plansRef.current);

          // Initialize subscription items from current subscription
          if (subscription?.items) {
            const currentItems = Array.isArray(subscription.items)
              ? subscription.items.map((item: any) => ({
                  priceId: item.price.id,
                  quantity: item.quantity,
                }))
              : [];
            setSubscriptionItems(currentItems);
          }

          setIsLoading(false);
          return;
        }

        // Otherwise fetch plans
        const response = await fetch("/api/stripe/plans");
        const data = await response.json();

        if (data.plans) {
          setAvailablePlans(data.plans);
          plansRef.current = data.plans;

          // Initialize subscription items from current subscription
          if (subscription?.items) {
            const currentItems = Array.isArray(subscription.items)
              ? subscription.items.map((item: any) => ({
                  priceId: item.price.id,
                  quantity: item.quantity,
                }))
              : [];
            setSubscriptionItems(currentItems);
          }
        } else {
          toast({
            title: "Error",
            description: "Failed to load subscription plans",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
        toast({
          title: "Error",
          description: "Failed to load subscription plans",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeDialog();
  }, [isOpen, subscription, toast]);

  const handleAddItem = () => {
    setSubscriptionItems([...subscriptionItems, { priceId: "", quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setSubscriptionItems(subscriptionItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof SubscriptionItem,
    value: string | number
  ) => {
    // If changing a priceId, check if it's already selected in another item
    if (field === "priceId" && typeof value === "string") {
      const isAlreadySelected = subscriptionItems.some(
        (item, i) => i !== index && item.priceId === value
      );

      if (isAlreadySelected) {
        toast({
          title: "Product already selected",
          description:
            "You've already added this product to your subscription.",
          variant: "destructive",
        });
        return;
      }
    }

    const newItems = [...subscriptionItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSubscriptionItems(newItems);
  };

  const calculateSubtotal = () => {
    return subscriptionItems.reduce((sum, item) => {
      const plan = availablePlans.find((p) => p.id === item.priceId);
      return sum + (plan ? (plan.unit_amount * item.quantity) / 100 : 0);
    }, 0);
  };

  const handleUpdate = async () => {
    const validItems = subscriptionItems.filter(
      (item) => item.priceId && item.quantity > 0
    );

    console.log("Validating subscription update items:", {
      original: subscriptionItems,
      filtered: validItems,
    });

    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive",
      });
      return;
    }

    // Warn if items have been removed
    // First check if subscription.items and subscription.items.data exist
    const subscriptionItemsData = subscription?.items?.data || [];
    const originalItemCount = subscriptionItemsData.length;

    if (validItems.length < originalItemCount) {
      const removedCount = originalItemCount - validItems.length;
      console.log(`User is removing ${removedCount} items from subscription`);

      const confirmed = window.confirm(
        `You are about to remove ${removedCount} product(s) from this subscription. Continue?`
      );
      if (!confirmed) {
        return;
      }
    }

    await onUpdate(validItems);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        console.log("Dialog onOpenChange called with:", open);
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update Subscription</DialogTitle>
          <DialogDescription>
            Modify your subscription items below
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading subscription details...</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="space-y-4 py-4">
                {subscriptionItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-4 items-center"
                  >
                    <div className="col-span-5">
                      <Select
                        value={item.priceId}
                        onValueChange={(value) =>
                          handleItemChange(index, "priceId", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePlans.map((plan) => (
                            <SelectItem
                              key={plan.id}
                              value={plan.id}
                              disabled={isProductSelected(plan.id, index)}
                              className={
                                isProductSelected(plan.id, index)
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }
                            >
                              {plan.product.name} -{" "}
                              {formatCurrency(plan.unit_amount)}
                              {isProductSelected(plan.id, index) &&
                                " (Already added)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "quantity",
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-20"
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleAddItem}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Another Product
                </Button>
              </div>
            </ScrollArea>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(calculateSubtotal() * 100)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total excluding tax</span>
                <span>{formatCurrency(calculateSubtotal() * 100)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(calculateSubtotal() * 100)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Amount due</span>
                <span>{formatCurrency(calculateSubtotal() * 100)}</span>
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={
                    !subscriptionItems.some((item) => item.priceId) ||
                    isProcessing ||
                    isLoading
                  }
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4" />
                  )}
                  Update
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Skeleton UI for subscription tab
function SubscriptionSkeleton() {
  return (
    <Card className="w-full p-6 border rounded-xl shadow-sm transition-all duration-300">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 bg-primary/10 animate-pulse" />
            <Skeleton className="h-4 w-32 bg-primary/5 animate-pulse" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md bg-primary/10 animate-pulse" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-5 rounded-full bg-primary/10 animate-pulse" />
            <Skeleton className="h-5 w-40 bg-primary/10 animate-pulse" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 bg-primary/5 animate-pulse" />
              <Skeleton className="h-6 w-32 bg-primary/10 animate-pulse" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 bg-primary/5 animate-pulse" />
              <Skeleton className="h-6 w-32 bg-primary/10 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-5 w-40 bg-primary/10 animate-pulse" />
          <div className="border rounded-md p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-32 bg-primary/10 animate-pulse" />
                <Skeleton className="h-5 w-24 bg-primary/10 animate-pulse" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-36 bg-primary/10 animate-pulse" />
                <Skeleton className="h-5 w-20 bg-primary/10 animate-pulse" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-28 bg-primary/10 animate-pulse" />
                <Skeleton className="h-5 w-28 bg-primary/10 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Skeleton UI for payment methods tab
function PaymentMethodsSkeleton() {
  return (
    <Card className="w-full p-6 border rounded-xl shadow-sm transition-all duration-300">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 bg-primary/10 animate-pulse" />
            <Skeleton className="h-4 w-64 bg-primary/5 animate-pulse" />
          </div>
          <Skeleton className="h-9 w-40 rounded-md bg-primary/10 animate-pulse" />
        </div>

        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-6 rounded bg-primary/10 animate-pulse" />
                  <Skeleton className="h-5 w-32 bg-primary/10 animate-pulse" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-8 w-8 rounded-full bg-primary/10 animate-pulse" />
                  <Skeleton className="h-8 w-8 rounded-full bg-primary/10 animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20 bg-primary/5 animate-pulse" />
                  <Skeleton className="h-5 w-28 bg-primary/10 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20 bg-primary/5 animate-pulse" />
                  <Skeleton className="h-5 w-24 bg-primary/10 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// Skeleton UI for invoices tab
function InvoicesSkeleton() {
  return (
    <Card className="w-full p-6 border rounded-xl shadow-sm transition-all duration-300">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 bg-primary/10 animate-pulse" />
            <Skeleton className="h-4 w-64 bg-primary/5 animate-pulse" />
          </div>
          <Skeleton className="h-9 w-40 rounded-md bg-primary/10 animate-pulse" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <Skeleton className="h-4 w-24 bg-primary/5 animate-pulse mb-2" />
            <Skeleton className="h-8 w-32 bg-primary/10 animate-pulse" />
          </div>
          <div className="border rounded-lg p-4">
            <Skeleton className="h-4 w-24 bg-primary/5 animate-pulse mb-2" />
            <Skeleton className="h-8 w-32 bg-primary/10 animate-pulse" />
          </div>
          <div className="border rounded-lg p-4">
            <Skeleton className="h-4 w-24 bg-primary/5 animate-pulse mb-2" />
            <Skeleton className="h-8 w-32 bg-primary/10 animate-pulse" />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted p-3">
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-5 w-full bg-primary/10 animate-pulse" />
              <Skeleton className="h-5 w-full bg-primary/10 animate-pulse" />
              <Skeleton className="h-5 w-full bg-primary/10 animate-pulse" />
              <Skeleton className="h-5 w-full bg-primary/10 animate-pulse" />
            </div>
          </div>

          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3">
                <div className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-5 w-full bg-primary/5 animate-pulse" />
                  <Skeleton className="h-5 w-full bg-primary/5 animate-pulse" />
                  <Skeleton className="h-5 w-full bg-primary/5 animate-pulse" />
                  <div className="flex justify-end space-x-2">
                    <Skeleton className="h-8 w-8 rounded-full bg-primary/10 animate-pulse" />
                    <Skeleton className="h-8 w-8 rounded-full bg-primary/10 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function StripeTabs({
  company,
  preloadedData,
  isLoading: externalLoading,
  defaultTab = "subscription",
}: StripeTabsProps) {
  // Group all useState hooks together at the top
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(externalLoading || false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [createSubscriptionDialogOpen, setCreateSubscriptionDialogOpen] =
    useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] =
    useState(false);
  const [cancelSubscriptionDialogOpen, setCancelSubscriptionDialogOpen] =
    useState(false);
  const [isPausingSubscription, setIsPausingSubscription] = useState(false);
  const [pauseSubscriptionDialogOpen, setPauseSubscriptionDialogOpen] =
    useState(false);
  const [isResumingSubscription, setIsResumingSubscription] = useState(false);
  const [resumeSubscriptionDialogOpen, setResumeSubscriptionDialogOpen] =
    useState(false);
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [addPaymentMethodDialogOpen, setAddPaymentMethodDialogOpen] =
    useState(false);
  const [loadingTabs, setLoadingTabs] = useState({
    subscription: false,
    "payment-methods": false,
    invoices: false,
  });
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false);
  const [isCreateSubscriptionOpen, setIsCreateSubscriptionOpen] =
    useState(false);
  const [isUpdateSubscriptionOpen, setIsUpdateSubscriptionOpen] =
    useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);

  // Debug effect for dialog state
  useEffect(() => {
    console.log(
      "createSubscriptionDialogOpen state changed:",
      createSubscriptionDialogOpen
    );
  }, [createSubscriptionDialogOpen]);

  // All useRef hooks
  const dataFetchedRef = useRef({
    subscription: false,
    "payment-methods": false,
    invoices: false,
    any: false,
  });

  // Add plansRef for storing available plans
  const plansRef = useRef<any[]>([]);

  // Get toast from context
  const { toast } = useToast();

  // Update default payment method detection
  const defaultPaymentMethodId =
    subscriptionDetails?.customer?.invoice_settings?.default_payment_method;

  // All useEffect hooks
  // Add animation effect when content loads
  useEffect(() => {
    if (!isLoading && subscriptionDetails) {
      // Delay to ensure smooth transition
      const timer = setTimeout(() => {
        setContentVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setContentVisible(false);
    }
  }, [isLoading, subscriptionDetails]);

  // Update preloadedData effect to mark data as fetched
  useEffect(() => {
    if (preloadedData) {
      setSubscriptionDetails(preloadedData);
      setPaymentMethods(preloadedData.paymentMethods || []);

      // Mark data as fetched if we have preloaded data
      dataFetchedRef.current = {
        subscription: true,
        "payment-methods": true,
        invoices: true,
        any: true,
      };
    }
  }, [preloadedData]);

  // Update isLoading when externalLoading changes
  useEffect(() => {
    if (externalLoading !== undefined) {
      setIsLoading(externalLoading);
    }
  }, [externalLoading]);

  // Define fetchData first with useCallback
  const fetchData = useCallback(
    async (tabToLoad?: string) => {
      if (!company.stripe_customer_id) {
        setIsLoading(false);
        return;
      }

      try {
        const now = Date.now();
        const cachedPaymentMethods = paymentMethodsCache.get(company.id);
        const cachedSubscriptionDetails = subscriptionDetailsCache.get(
          company.id
        );

        // Set loading state for specific tab
        if (tabToLoad) {
          setLoadingTabs((prev) => ({ ...prev, [tabToLoad]: true }));
        }

        // Use cached data if available and not expired
        if (
          cachedPaymentMethods &&
          now - cachedPaymentMethods.timestamp < CACHE_TTL
        ) {
          setPaymentMethods(cachedPaymentMethods.data);
        }
        if (
          cachedSubscriptionDetails &&
          now - cachedSubscriptionDetails.timestamp < CACHE_TTL
        ) {
          setSubscriptionDetails(cachedSubscriptionDetails.data);

          // Mark data as fetched when using cached data
          dataFetchedRef.current = {
            subscription: true,
            "payment-methods": true,
            invoices: true,
            any: true,
          };

          return;
        }

        // Only fetch if we don't have valid cached data
        const details = await getStripeSubscriptionDetails(company.id);

        paymentMethodsCache.set(company.id, {
          data: details.paymentMethods,
          timestamp: now,
        });
        subscriptionDetailsCache.set(company.id, {
          data: details,
          timestamp: now,
        });

        setSubscriptionDetails(details);
        setPaymentMethods(details.paymentMethods);

        // Mark data as fetched after successful fetch
        dataFetchedRef.current = {
          subscription: true,
          "payment-methods": true,
          invoices: true,
          any: true,
        };
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        if (tabToLoad) {
          setLoadingTabs((prev) => ({ ...prev, [tabToLoad]: false }));
        }
      }
    },
    [company.id, company.stripe_customer_id, toast]
  );

  // Then define handleTabChange with fetchData in its dependencies
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);

      // Always set loading state for the selected tab for better UX
      setLoadingTabs((prev) => ({ ...prev, [tab]: true }));

      // Set a minimum loading time to ensure the loading state is visible
      setTimeout(() => {
        setLoadingTabs((prev) => ({ ...prev, [tab]: false }));
      }, 300); // Brief loading indicator for better UX

      // If we already have data for this tab, don't fetch again
      if (dataFetchedRef.current.any) {
        console.log(`Using already fetched data for ${tab} tab`);
        return;
      }

      // Check if we have cached data before fetching
      const cachedData = subscriptionDetailsCache.get(company.id);
      const now = Date.now();
      const isCacheValid = cachedData && now - cachedData.timestamp < CACHE_TTL;

      // Only fetch data if we don't have valid cached data
      if (!isCacheValid && (!subscriptionDetails || !paymentMethods.length)) {
        // Load all data if we don't have any yet
        console.log(`Fetching data for ${tab} tab`);
        fetchData(tab);
      }
    },
    [company.id, subscriptionDetails, paymentMethods.length, fetchData]
  );

  // Initial data fetch
  useEffect(() => {
    // If we have preloaded data, don't fetch again
    if (preloadedData) {
      // Mark data as fetched if we have preloaded data
      dataFetchedRef.current = {
        subscription: true,
        "payment-methods": true,
        invoices: true,
        any: true,
      };
      return;
    }

    const now = Date.now();
    const cachedPaymentMethods = paymentMethodsCache.get(company.id);
    const cachedSubscriptionDetails = subscriptionDetailsCache.get(company.id);

    // If we have valid cached data, use it immediately
    if (
      cachedPaymentMethods &&
      now - cachedPaymentMethods.timestamp < CACHE_TTL
    ) {
      setPaymentMethods(cachedPaymentMethods.data);
      dataFetchedRef.current["payment-methods"] = true;
      dataFetchedRef.current.any = true;
    }
    if (
      cachedSubscriptionDetails &&
      now - cachedSubscriptionDetails.timestamp < CACHE_TTL
    ) {
      setSubscriptionDetails(cachedSubscriptionDetails.data);
      setIsLoading(false);

      // Mark all data as fetched when using cached subscription details
      dataFetchedRef.current = {
        subscription: true,
        "payment-methods": true,
        invoices: true,
        any: true,
      };
    } else {
      // Only fetch if we don't have valid cached data
      // Use setTimeout to defer the loading to the next tick
      // This allows the component to render with a loading state first
      setTimeout(() => {
        fetchData(activeTab).finally(() => {
          setIsLoading(false);
        });
      }, 0);
    }
  }, [company.id, preloadedData, activeTab, fetchData]);

  const handleRemovePaymentMethod = useCallback(
    async (paymentMethodId: string) => {
      if (paymentMethodId === defaultPaymentMethodId) {
        toast({
          title: "Error",
          description: "Cannot remove default payment method",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsProcessing(true);

        // Optimistic update
        const updatedMethods = paymentMethods.filter(
          (method) => method.id !== paymentMethodId
        );
        setPaymentMethods(updatedMethods);

        await removePaymentMethod(company.id, paymentMethodId);

        // Update cache
        paymentMethodsCache.set(company.id, {
          data: updatedMethods,
          timestamp: Date.now(),
        });

        toast({
          title: "Success",
          description: "Payment method removed successfully",
        });
      } catch (error) {
        // Revert on error
        await fetchData();
        console.error("Error removing payment method:", error);
        toast({
          title: "Error",
          description: "Failed to remove payment method",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [company.id, defaultPaymentMethodId, fetchData, paymentMethods, toast]
  );

  const handleSetDefault = useCallback(
    async (paymentMethodId: string) => {
      if (paymentMethodId === defaultPaymentMethodId) return;

      try {
        setIsProcessing(true);

        // Optimistic update
        const updatedDetails = {
          ...subscriptionDetails,
          customer: {
            ...subscriptionDetails.customer,
            invoice_settings: {
              ...subscriptionDetails.customer?.invoice_settings,
              default_payment_method: paymentMethodId,
            },
          },
        };
        setSubscriptionDetails(updatedDetails);

        await setDefaultPaymentMethod(company.id, paymentMethodId);

        // Update cache
        subscriptionDetailsCache.set(company.id, {
          data: updatedDetails,
          timestamp: Date.now(),
        });

        toast({
          title: "Success",
          description: "Default payment method updated successfully",
        });
      } catch (error) {
        // Revert on error
        await fetchData();
        console.error("Error setting default payment method:", error);
        toast({
          title: "Error",
          description: "Failed to set default payment method",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [company.id, defaultPaymentMethodId, fetchData, subscriptionDetails, toast]
  );

  const handleUpdateSubscriptionItems = useCallback(
    async (items: SubscriptionItem[]) => {
      if (!subscriptionDetails?.subscription?.id) return;

      try {
        setIsProcessing(true);

        // Get available plans first
        const plansResponse = await fetch("/api/stripe/plans");
        const plansData = await plansResponse.json();
        const availablePlans = plansData.plans || [];

        // Calculate total subscription amount in cents (Stripe uses cents)
        const totalAmount = items.reduce((sum, item) => {
          const plan = availablePlans.find(
            (plan: { id: string }) => plan.id === item.priceId
          );
          return sum + (plan ? plan.unit_amount * item.quantity : 0);
        }, 0);

        console.log("Calculated new subscription total amount:", totalAmount);

        // Optimistically update the UI
        const updatedSubscription = {
          ...subscriptionDetails.subscription,
          items: items.map((item) => ({
            id: Math.random().toString(), // Temporary ID
            price: availablePlans.find(
              (plan: { id: string }) => plan.id === item.priceId
            ),
            quantity: item.quantity,
          })),
        };

        // Update both the subscription and cache
        const updatedDetails = {
          ...subscriptionDetails,
          subscription: updatedSubscription,
        };

        setSubscriptionDetails(updatedDetails);
        subscriptionDetailsCache.set(company.id, {
          data: updatedDetails,
          timestamp: Date.now(),
        });

        console.log("Updating subscription with items:", items);

        // Call your API to update the subscription
        const response = await fetch(
          `/api/stripe/subscriptions/${subscriptionDetails.subscription.id}/update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ items }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Subscription update failed:", errorData);
          throw new Error(errorData.details || "Failed to update subscription");
        }

        const result = await response.json();
        console.log("Subscription update successful:", result);

        // Update the company's subscription amount in the database
        try {
          await fetch(`/api/companies/${company.id}/update`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              stripe_subscription_amount: totalAmount,
              stripe_subscription_id: subscriptionDetails.subscription.id,
            }),
          });
          console.log("Updated company subscription amount:", totalAmount);
        } catch (updateError) {
          console.error(
            "Failed to update company subscription amount:",
            updateError
          );
        }

        // Close the dialog before fetching fresh data
        setIsUpdateSubscriptionOpen(false);

        // Refresh data in the background to ensure consistency
        fetchData().catch(console.error);

        toast({
          title: "Success",
          description: "Subscription updated successfully",
        });
      } catch (error) {
        console.error("Error updating subscription:", error);
        // Revert optimistic update on error
        await fetchData();
        toast({
          title: "Error",
          description: "Failed to update subscription",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [company.id, fetchData, subscriptionDetails, toast]
  );

  const handleCreateSubscription = useCallback(
    async (items: SubscriptionItem[]) => {
      if (!company.stripe_customer_id) {
        toast({
          title: "Error",
          description: "Company is not properly configured with Stripe",
          variant: "destructive",
        });
        return;
      }

      // Check if payment methods are available
      if (paymentMethods.length === 0) {
        toast({
          title: "Payment Method Required",
          description:
            "Please add a payment method before creating a subscription",
          variant: "destructive",
        });
        // Switch to the payment methods tab
        setActiveTab("payment-methods");
        // Open the dialog to add a payment method
        setIsPaymentMethodsOpen(true);
        return;
      }

      try {
        setIsProcessing(true);

        // Calculate total subscription amount in cents (Stripe uses cents)
        let totalAmount = 0;
        // First get available plans if we don't have them
        if (!plansRef.current.length) {
          const plansResponse = await fetch("/api/stripe/plans");
          const plansData = await plansResponse.json();
          plansRef.current = plansData.plans || [];
        }

        // Calculate total amount based on items and their quantities
        totalAmount = items.reduce((sum, item) => {
          const plan = plansRef.current.find((p) => p.id === item.priceId);
          return sum + (plan ? plan.unit_amount * item.quantity : 0);
        }, 0);

        console.log("Creating subscription with total amount:", totalAmount);

        // Create subscription with multiple items
        const result = await createSubscription({
          customerId: company.stripe_customer_id,
          items: items.map((item) => ({
            price: item.priceId,
            quantity: item.quantity,
          })),
        });

        // Close the dialog before fetching fresh data
        setCreateSubscriptionDialogOpen(false);

        // Update the local state optimistically
        if (result?.subscription) {
          const updatedDetails = {
            ...subscriptionDetails,
            subscription: result.subscription,
          };

          setSubscriptionDetails(updatedDetails);
          subscriptionDetailsCache.set(company.id, {
            data: updatedDetails,
            timestamp: Date.now(),
          });

          // Update the company's subscription amount in the database
          try {
            await fetch(`/api/companies/${company.id}/update`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                stripe_subscription_amount: totalAmount,
                stripe_subscription_id: result.subscription.id,
              }),
            });
            console.log("Updated company subscription amount:", totalAmount);
          } catch (updateError) {
            console.error(
              "Failed to update company subscription amount:",
              updateError
            );
          }
        }

        // Refresh data in the background to ensure consistency
        fetchData().catch(console.error);

        toast({
          title: "Success",
          description: "Subscription created successfully",
        });
      } catch (error: any) {
        console.error("Error creating subscription:", error);
        const errorMessage = error?.message || "Failed to create subscription";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [
      company.id,
      company.stripe_customer_id,
      fetchData,
      subscriptionDetails,
      toast,
      paymentMethods,
      setActiveTab,
      setIsPaymentMethodsOpen,
      plansRef,
    ]
  );

  const handleCancelSubscription = useCallback(async () => {
    if (!subscriptionDetails?.subscription?.id) return;

    try {
      setIsProcessing(true);

      // Optimistically update the UI
      setSubscriptionDetails((prev: typeof subscriptionDetails) => ({
        ...prev,
        subscription: {
          ...prev.subscription,
          status: "canceled",
          canceled_at: Date.now() / 1000,
          cancel_at: prev.subscription.current_period_end,
        },
      }));

      await cancelSubscription(subscriptionDetails.subscription.id);

      // Update the company's subscription amount to 0 in the database
      try {
        await fetch(`/api/companies/${company.id}/update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripe_subscription_amount: 0,
          }),
        });
        console.log("Reset company subscription amount to 0");
      } catch (updateError) {
        console.error(
          "Failed to reset company subscription amount:",
          updateError
        );
      }

      // Refresh data to ensure consistency
      await fetchData();

      toast({
        title: "Success",
        description: "Subscription cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      // Revert optimistic update on error
      await fetchData();
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fetchData, subscriptionDetails, toast, company.id]);

  const handlePauseSubscription = useCallback(async () => {
    if (!subscriptionDetails?.subscription?.id) return;

    try {
      setIsProcessing(true);

      // Optimistically update the UI
      setSubscriptionDetails((prev: typeof subscriptionDetails) => ({
        ...prev,
        subscription: {
          ...prev.subscription,
          status: "paused",
        },
      }));

      await pauseSubscription(subscriptionDetails.subscription.id);

      // Refresh data to ensure consistency
      await fetchData();

      toast({
        title: "Success",
        description: "Subscription paused successfully",
      });
    } catch (error) {
      console.error("Error pausing subscription:", error);
      // Revert optimistic update on error
      await fetchData();
      toast({
        title: "Error",
        description: "Failed to pause subscription",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fetchData, subscriptionDetails, toast]);

  const handleResumeSubscription = useCallback(async () => {
    if (!subscriptionDetails?.subscription?.id) return;

    try {
      setIsProcessing(true);

      // Optimistically update the UI
      setSubscriptionDetails((prev: typeof subscriptionDetails) => ({
        ...prev,
        subscription: {
          ...prev.subscription,
          status: "active",
        },
      }));

      await resumeSubscription(subscriptionDetails.subscription.id);

      // Refresh data to ensure consistency
      await fetchData();

      toast({
        title: "Success",
        description: "Subscription resumed successfully",
      });
    } catch (error) {
      console.error("Error resuming subscription:", error);
      // Revert optimistic update on error
      await fetchData();
      toast({
        title: "Error",
        description: "Failed to resume subscription",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fetchData, subscriptionDetails, toast]);

  const handleSharePaymentLink = useCallback(async () => {
    if (!subscriptionDetails?.subscription?.id) return;

    try {
      setIsProcessing(true);
      const response = await fetch(
        `/api/stripe/payment-link/${subscriptionDetails.subscription.id}`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      // Copy link to clipboard
      await navigator.clipboard.writeText(data.url);

      toast({
        title: "Success",
        description: "Payment update link copied to clipboard",
      });
    } catch (error) {
      console.error("Error generating payment link:", error);
      toast({
        title: "Error",
        description: "Failed to generate payment link",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [subscriptionDetails, toast]);

  const handleCreateOneTimeInvoice = useCallback(async () => {
    if (!subscriptionDetails?.subscription?.id) return;

    try {
      setIsProcessing(true);
      setIsCreateInvoiceOpen(true);
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [subscriptionDetails]);

  const handleExcludeFromAutoCancellation = useCallback(async () => {
    if (!subscriptionDetails?.subscription?.id) return;

    try {
      setIsProcessing(true);
      await fetch(
        `/api/stripe/exclude-auto-cancel/${subscriptionDetails.subscription.id}`,
        {
          method: "POST",
        }
      );

      toast({
        title: "Success",
        description: "Subscription excluded from auto-cancellation",
      });

      await fetchData(); // Refresh data
    } catch (error) {
      console.error("Error excluding from auto-cancellation:", error);
      toast({
        title: "Error",
        description: "Failed to exclude from auto-cancellation",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [fetchData, subscriptionDetails, toast]);

  const handlePaymentMethodSuccess = useCallback(async () => {
    setIsPaymentMethodsOpen(false);
    await fetchData();
  }, [fetchData]);

  const handleDownloadAllInvoices = useCallback(async () => {
    try {
      setIsProcessing(true);

      // Create a form to submit as POST
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/stripe/download-all-invoices";
      form.target = "_blank";

      // Add company ID as hidden input
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "companyId";
      input.value = company.id.toString();
      form.appendChild(input);

      // Add form to body, submit it, and remove it
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      toast({
        title: "Download Started",
        description: "Your invoices are being prepared for download.",
      });
    } catch (error) {
      console.error("Error downloading invoices:", error);
      toast({
        title: "Error",
        description: "Failed to download invoices",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [company.id, toast]);

  const handleClearCache = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await clearCompanyCache(company.id);
      if (result.success) {
        toast({
          title: "Success",
          description: "Cache cleared successfully",
        });
        // Reload the data
        await fetchData();
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
      setIsLoading(false);
    }
  }, [company.id, fetchData, toast]);

  const renderSubscriptionActions = useCallback(() => {
    const subscription = subscriptionDetails?.subscription;
    const isCanceled = subscription?.status === "canceled";
    const hasNoSubscription = !subscription;

    if (hasNoSubscription || isCanceled) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {isCanceled ? (
                <>
                  <Badge variant="destructive" className="mr-2">
                    Canceled
                  </Badge>
                  <span>Subscription</span>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="mr-2">
                    Inactive
                  </Badge>
                  <span>No Active Subscription</span>
                </>
              )}
            </h3>
            <Button
              variant={isCanceled ? "outline" : "default"}
              size="sm"
              onClick={() => {
                console.log("Subscription actions Create button clicked");
                console.log(
                  "Before state change:",
                  createSubscriptionDialogOpen
                );
                setCreateSubscriptionDialogOpen(true);
                console.log("After state change:", true);
              }}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {isCanceled ? "Create New Subscription" : "Create Subscription"}
            </Button>
          </div>
          {/* Temporarily comment out this instance of the dialog to avoid duplicate components
          <CreateSubscriptionDialog
            onSubscribe={handleCreateSubscription}
            isOpen={createSubscriptionDialogOpen}
            onOpenChange={setCreateSubscriptionDialogOpen}
            isProcessing={isProcessing}
          />
          */}
          {isCanceled && (
            <div className="text-sm text-muted-foreground mt-2 p-4 bg-muted/20 rounded-lg border border-dashed">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span>
                  Canceled on{" "}
                  {new Date(
                    subscription.canceled_at * 1000
                  ).toLocaleDateString()}
                </span>
              </div>
              {subscription.cancel_at && (
                <div className="flex items-center gap-2 mt-1">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Access until{" "}
                    {new Date(
                      subscription.cancel_at * 1000
                    ).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    const isPaused = subscription.status === "paused";
    const totalAmount = Array.isArray(subscription.items)
      ? subscription.items.reduce(
          (sum: number, item: any) =>
            sum + (item.price.unit_amount * item.quantity || 0),
          0
        )
      : 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">Subscription</h3>
              <Badge
                variant={
                  subscription.status === "active"
                    ? "success"
                    : subscription.status === "paused"
                      ? "outline"
                      : "secondary"
                }
                className="capitalize"
              >
                {subscription.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <span>
                  Started{" "}
                  {new Date(subscription.created * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>
                  Next invoice $
                  {subscriptionDetails?.upcoming_invoice?.amount_due
                    ? (
                        subscriptionDetails.upcoming_invoice.amount_due / 100
                      ).toFixed(2)
                    : "calculating..."}{" "}
                  on{" "}
                  {new Date(
                    subscription.current_period_end * 1000
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {subscription.status === "active" && (
              <>
                <Button
                  variant="outline"
                  onClick={handlePauseSubscription}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  Pause Collection
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => setIsUpdateSubscriptionOpen(true)}
                      disabled={isProcessing}
                      className="cursor-pointer hover:bg-muted focus:bg-muted group"
                    >
                      <Pencil className="mr-2 h-4 w-4 group-hover:text-foreground text-muted-foreground" />
                      Update subscription
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSharePaymentLink}
                      disabled={isProcessing}
                      className="cursor-pointer hover:bg-muted focus:bg-muted group"
                    >
                      <Link className="mr-2 h-4 w-4 group-hover:text-foreground text-muted-foreground" />
                      Share payment update link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleCreateOneTimeInvoice}
                      disabled={isProcessing}
                      className="cursor-pointer hover:bg-muted focus:bg-muted group"
                    >
                      <FileText className="mr-2 h-4 w-4 group-hover:text-foreground text-muted-foreground" />
                      Create one-time invoice
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleExcludeFromAutoCancellation}
                      disabled={isProcessing}
                      className="cursor-pointer hover:bg-muted focus:bg-muted group"
                    >
                      <ShieldCheck className="mr-2 h-4 w-4 group-hover:text-foreground text-muted-foreground" />
                      Exclude from auto-cancellation
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 group"
                      onClick={handleCancelSubscription}
                      disabled={isProcessing}
                    >
                      <Trash className="mr-2 h-4 w-4 group-hover:text-destructive" />
                      Cancel subscription...
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {isPaused && (
              <Button
                onClick={handleResumeSubscription}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Resume Subscription
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    subscriptionDetails,
    isProcessing,
    createSubscriptionDialogOpen,
    handleCreateSubscription,
    handlePauseSubscription,
    handleSharePaymentLink,
    handleCreateOneTimeInvoice,
    handleExcludeFromAutoCancellation,
    handleCancelSubscription,
    handleResumeSubscription,
    setCreateSubscriptionDialogOpen,
    setIsUpdateSubscriptionOpen,
  ]);

  // Prepare loading and empty state components outside of the render function
  const loadingComponent = (
    <Card className="w-full p-6 border rounded-xl shadow-sm transition-all duration-300">
      <div className="flex flex-col items-center justify-center space-y-6 p-10 min-h-[400px]">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
        <div className="text-center space-y-3">
          <h3 className="text-xl font-medium">Loading Billing Information</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Please wait while we retrieve your billing data. This may take a few
            moments...
          </p>
        </div>
        <div className="w-full max-w-md h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary animate-pulse rounded-full"
            style={{ width: "75%" }}
          ></div>
        </div>
      </div>
    </Card>
  );

  const noDataComponent = (
    <Card className="w-full p-6 border rounded-xl shadow-sm transition-all duration-300">
      <div className="flex flex-col items-center justify-center space-y-4 p-10 min-h-[400px]">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
          <CreditCard className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-medium">No Billing Data Available</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            There was an issue loading your billing information. Please try
            refreshing the page.
          </p>
        </div>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Refresh Page
        </Button>
      </div>
    </Card>
  );

  // Render based on loading and data state
  if (isLoading) {
    // Show the appropriate skeleton based on the active tab
    return (
      <>
        {activeTab === "subscription" && <SubscriptionSkeleton />}
        {activeTab === "payment-methods" && <PaymentMethodsSkeleton />}
        {activeTab === "invoices" && <InvoicesSkeleton />}
      </>
    );
  }

  if (!subscriptionDetails && !isLoading) {
    return noDataComponent;
  }

  return (
    <>
      {!dataFetchedRef.current.any && (
        <div className="flex items-center justify-center py-4 px-6 bg-muted/30 rounded-md mb-6 border border-muted">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-3" />
          <span className="text-sm font-medium">
            Loading billing data... Please wait
          </span>
        </div>
      )}

      <Tabs
        defaultValue="subscription"
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <div className="flex justify-between items-center">
          <TabsList className="bg-background border rounded-lg p-0 shadow-sm">
            <TabsTrigger
              value="subscription"
              className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-5 py-2.5 text-sm font-medium transition-all"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Subscription
            </TabsTrigger>
            <TabsTrigger
              value="payment-methods"
              className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-5 py-2.5 text-sm font-medium transition-all"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Methods
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              className="rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm px-5 py-2.5 text-sm font-medium transition-all"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Invoices
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payment-methods">
          {isLoading || loadingTabs["payment-methods"] ? (
            <PaymentMethodsSkeleton />
          ) : (
            <Card
              className={cn("p-6 border rounded-xl shadow-sm transition-all", {
                "opacity-0 scale-98 transition-all duration-300":
                  !contentVisible,
                "opacity-100 scale-100 transition-all duration-300":
                  contentVisible,
              })}
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-semibold">Payment Methods</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your payment methods for billing
                  </p>
                </div>
                <Button
                  onClick={() => setIsPaymentMethodsOpen(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Payment Method
                </Button>
              </div>
              <ScrollArea className="h-[400px] pr-4">
                {loadingTabs["payment-methods"] ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className="flex items-center justify-between px-4 py-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-8 flex items-center">
                              {method.card.brand === "visa" && (
                                <div className="text-[#1434CB] font-bold text-sm uppercase">
                                  Visa
                                </div>
                              )}
                              {method.card.brand === "mastercard" && (
                                <div className="text-[#1434CB] font-bold text-sm uppercase">
                                  Mastercard
                                </div>
                              )}
                              {method.card.brand === "amex" && (
                                <div className="text-[#1434CB] font-bold text-sm uppercase">
                                  Amex
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {method.card.brand.charAt(0).toUpperCase() +
                                    method.card.brand.slice(1)}{" "}
                                  •••• {method.card.last4}
                                </span>
                                {method.id === defaultPaymentMethodId && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                  >
                                    Default
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Expires{" "}
                                {method.card.exp_month
                                  .toString()
                                  .padStart(2, "0")}
                                /{method.card.exp_year.toString().slice(-2)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {method.id !== defaultPaymentMethodId && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetDefault(method.id)}
                                disabled={isProcessing}
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                              >
                                Make default
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRemovePaymentMethod(method.id)
                                }
                                disabled={isProcessing}
                                className="h-8 px-2 text-destructive hover:text-destructive"
                              >
                                Remove
                              </Button>
                            </>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-muted/10 rounded-lg border border-dashed">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No Payment Methods</h3>
                    <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                      Add a payment method to process payments and manage your
                      subscriptions.
                    </p>
                    <Button
                      onClick={() => setIsPaymentMethodsOpen(true)}
                      variant="outline"
                      className="mt-6"
                      size="lg"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Payment Method
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subscription">
          {isLoading || loadingTabs.subscription ? (
            <SubscriptionSkeleton />
          ) : subscriptionDetails?.subscription ? (
            <Card className="p-6 border rounded-xl shadow-sm transition-all duration-300">
              <div className="mb-6">{renderSubscriptionActions()}</div>
              {subscriptionDetails?.subscription && (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-card shadow-sm mb-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[35%] font-semibold">
                            Plan
                          </TableHead>
                          <TableHead className="font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="font-semibold">
                            Quantity
                          </TableHead>
                          <TableHead className="font-semibold">
                            Amount
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Next Bill
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(subscriptionDetails?.subscription?.items)
                          ? subscriptionDetails.subscription.items.map(
                              (item: any) => (
                                <TableRow
                                  key={item.id}
                                  className="hover:bg-muted/50"
                                >
                                  <TableCell className="font-medium">
                                    {item.price.nickname ||
                                      item.price.product.name}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="capitalize"
                                    >
                                      {subscriptionDetails.subscription.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{item.quantity || 1}</TableCell>
                                  <TableCell>
                                    {item.quantity > 1 ? (
                                      <>
                                        $
                                        {(
                                          (item.price.unit_amount || 0) / 100
                                        ).toFixed(2)}{" "}
                                        × {item.quantity} = $
                                        {(
                                          (item.price.unit_amount *
                                            item.quantity || 0) / 100
                                        ).toFixed(2)}
                                      </>
                                    ) : (
                                      <>
                                        $
                                        {(
                                          (item.price.unit_amount || 0) / 100
                                        ).toFixed(2)}
                                      </>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {new Date(
                                      subscriptionDetails.subscription
                                        .current_period_end * 1000
                                    ).toLocaleDateString()}
                                  </TableCell>
                                </TableRow>
                              )
                            )
                          : null}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="rounded-xl border bg-card shadow-sm p-6">
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">
                          $
                          {(Array.isArray(
                            subscriptionDetails.subscription.items
                          )
                            ? subscriptionDetails.subscription.items.reduce(
                                (sum: number, item: any) =>
                                  sum +
                                  (item.price.unit_amount * item.quantity || 0),
                                0
                              )
                            : 0) / 100}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="font-medium">$0.00</span>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between">
                          <span className="text-base font-semibold">
                            Total amount due
                          </span>
                          <span className="text-base font-semibold">
                            $
                            {(Array.isArray(
                              subscriptionDetails.subscription.items
                            )
                              ? subscriptionDetails.subscription.items.reduce(
                                  (sum: number, item: any) =>
                                    sum +
                                    (item.price.unit_amount * item.quantity ||
                                      0),
                                  0
                                )
                              : 0) / 100}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-6 border rounded-xl shadow-sm">
              <div className="flex flex-col items-center justify-center p-10 space-y-4">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <CreditCard className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-medium">
                    No Active Subscription
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Create a subscription to start managing your billing and
                    access premium features.
                  </p>
                </div>
                {paymentMethods.length === 0 ? (
                  <div className="space-y-4 w-full max-w-md mt-2">
                    <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 p-4 rounded-lg text-sm border border-amber-200 dark:border-amber-800/30">
                      <p className="flex items-start">
                        <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 text-amber-500" />
                        <span>
                          You need to add a payment method before creating a
                          subscription.
                        </span>
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setActiveTab("payment-methods");
                        setIsPaymentMethodsOpen(true);
                      }}
                      size="lg"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Add Payment Method
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      console.log("Create Subscription button clicked");
                      console.log(
                        "Before state change:",
                        createSubscriptionDialogOpen
                      );
                      setCreateSubscriptionDialogOpen(true);
                      console.log("After state change:", true);
                    }}
                    className="mt-4"
                    size="lg"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Subscription
                  </Button>
                )}
              </div>
            </Card>
          )}
          <CreateSubscriptionDialog
            onSubscribe={handleCreateSubscription}
            isOpen={createSubscriptionDialogOpen}
            onOpenChange={setCreateSubscriptionDialogOpen}
            isProcessing={isProcessing}
          />
        </TabsContent>

        <TabsContent value="invoices">
          {isLoading || loadingTabs.invoices ? (
            <InvoicesSkeleton />
          ) : (
            <Card
              className={cn("p-6 border rounded-xl shadow-sm transition-all", {
                "opacity-0 scale-98 transition-all duration-300":
                  !contentVisible,
                "opacity-100 scale-100 transition-all duration-300":
                  contentVisible,
              })}
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-semibold">Invoices</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    View and download invoice history
                  </p>
                </div>
                <div className="flex gap-2">
                  {subscriptionDetails?.invoices?.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleDownloadAllInvoices}
                      disabled={isProcessing}
                      className="h-9 flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Download All
                    </Button>
                  )}
                </div>
              </div>

              {subscriptionDetails?.invoices?.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card className="p-4 border border-muted bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="text-sm font-medium text-muted-foreground">
                      Total Paid
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {formatCurrency(
                        subscriptionDetails.invoices
                          .filter((inv: Invoice) => inv.status === "paid")
                          .reduce(
                            (sum: number, inv: Invoice) => sum + inv.amount_due,
                            0
                          )
                      )}
                    </div>
                  </Card>
                  <Card className="p-4 border border-muted bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="text-sm font-medium text-muted-foreground">
                      Outstanding
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {formatCurrency(
                        subscriptionDetails.invoices
                          .filter((inv: Invoice) => inv.status === "open")
                          .reduce(
                            (sum: number, inv: Invoice) => sum + inv.amount_due,
                            0
                          )
                      )}
                    </div>
                  </Card>
                  <Card className="p-4 border border-muted bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="text-sm font-medium text-muted-foreground">
                      Invoice Count
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {subscriptionDetails.invoices.length}
                    </div>
                  </Card>
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-md">
                {loadingTabs.invoices ? (
                  <div className="flex justify-center items-center h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : subscriptionDetails?.invoices?.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-medium">
                          Invoice Number
                        </TableHead>
                        <TableHead className="font-medium">Date</TableHead>
                        <TableHead className="font-medium">Amount</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptionDetails?.invoices?.map(
                        (invoice: Invoice) => (
                          <TableRow
                            key={invoice.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="font-medium">
                              {invoice.number || "Draft"}
                            </TableCell>
                            <TableCell>
                              {new Date(
                                invoice.created * 1000
                              ).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(invoice.amount_due)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  invoice.status === "paid"
                                    ? "success"
                                    : invoice.status === "open"
                                      ? "outline"
                                      : invoice.status === "draft"
                                        ? "secondary"
                                        : "destructive"
                                }
                                className="capitalize"
                              >
                                {invoice.status || "unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    window.open(
                                      `/api/stripe/invoice-pdf/${invoice.id}`,
                                      "_blank"
                                    )
                                  }
                                  className="h-8 px-2 text-xs"
                                >
                                  <FileText className="mr-1 h-3 w-3" />
                                  Download
                                </Button>
                                {invoice.hosted_invoice_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(
                                        invoice.hosted_invoice_url as string,
                                        "_blank"
                                      )
                                    }
                                    className="h-8 px-2 text-xs"
                                  >
                                    <Eye className="mr-1 h-3 w-3" />
                                    View
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-muted/10 rounded-lg border border-dashed">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Receipt className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No Invoices Found</h3>
                    <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                      No invoice history is available for this company yet.
                      Invoices will appear here once they are generated.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AddPaymentMethod
        open={isPaymentMethodsOpen}
        onOpenChange={setIsPaymentMethodsOpen}
        companyId={company.id}
        onSuccess={handlePaymentMethodSuccess}
      />

      <UpdateSubscriptionDialog
        subscription={subscriptionDetails?.subscription}
        isOpen={isUpdateSubscriptionOpen}
        onOpenChange={setIsUpdateSubscriptionOpen}
        isProcessing={isProcessing}
        onUpdate={handleUpdateSubscriptionItems}
      />

      {/* Add CreateSubscriptionDialog at the root level */}
      <CreateSubscriptionDialog
        onSubscribe={handleCreateSubscription}
        isOpen={createSubscriptionDialogOpen}
        onOpenChange={setCreateSubscriptionDialogOpen}
        isProcessing={isProcessing}
      />
    </>
  );
}
