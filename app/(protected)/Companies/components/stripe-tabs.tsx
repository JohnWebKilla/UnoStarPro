"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Company } from "../types";
import { useEffect, useState } from "react";
import {
  getStripeSubscriptionDetails,
  getCompanyPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  createSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getAvailablePlans,
} from "../stripe-actions";
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

// Client-side cache
const paymentMethodsCache = new Map<
  number,
  { data: any[]; timestamp: number }
>();
const subscriptionDetailsCache = new Map<
  number,
  { data: any; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

interface StripeTabsProps {
  company: Company;
}

interface SubscriptionItem {
  priceId: string;
  quantity: number;
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
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/stripe/plans");
        const data = await response.json();

        if (data.plans) {
          setAvailablePlans(data.plans);
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

    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

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
        description: "Please select at least one plan",
        variant: "destructive",
      });
      return;
    }
    await onSubscribe(validItems);
    onOpenChange(false);
  };

  const calculateSubtotal = () => {
    return subscriptionItems.reduce(
      (sum: number, item: SubscriptionItem) =>
        sum + item.quantity * (item.priceId ? 1 : 0),
      0
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Subscription</DialogTitle>
          <DialogDescription>
            Choose one or more plans to subscribe to
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-4 py-4">
              {subscriptionItems.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-4 items-start p-4 border rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Select Plan</label>
                    <Select
                      value={item.priceId}
                      onValueChange={(value) =>
                        handleItemChange(index, "priceId", value)
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlans.map((plan) => (
                          <SelectItem
                            key={plan.id}
                            value={plan.id}
                            disabled={subscriptionItems.some(
                              (item, i) =>
                                i !== index && item.priceId === plan.id
                            )}
                          >
                            {plan.product.name} -{" "}
                            {(plan.unit_amount / 100).toFixed(2)}{" "}
                            {plan.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
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
                      disabled={isLoading || isProcessing}
                      className="mt-2"
                    />
                  </div>
                  {subscriptionItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="mt-8"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                onClick={handleAddItem}
                disabled={isLoading || isProcessing}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Plan
              </Button>
            </div>
          </ScrollArea>

          <div className="border-t mt-6 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Total excluding tax
                </span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="font-medium">
                  ${calculateSubtotal().toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Amount due</span>
                <span className="font-medium">
                  ${calculateSubtotal().toFixed(2)}
                </span>
              </div>
            </div>
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
              onClick={handleSubscribe}
              disabled={
                !subscriptionItems.some((item) => item.priceId) ||
                isProcessing ||
                isLoading
              }
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Subscribe
            </Button>
          </div>
        </div>
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
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/stripe/plans");
        const data = await response.json();

        if (data.plans) {
          setAvailablePlans(data.plans);
          // Initialize subscription items from current subscription
          const currentItems = subscription.items.map((item: any) => ({
            priceId: item.price.id,
            quantity: item.quantity,
          }));
          setSubscriptionItems(currentItems);
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

    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen, subscription]);

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
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one plan",
        variant: "destructive",
      });
      return;
    }
    await onUpdate(validItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update Subscription</DialogTitle>
          <DialogDescription>
            Modify your subscription items below
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-4 py-4">
              {subscriptionItems.map((item, index) => (
                <div
                  key={index}
                  className="flex gap-4 items-start p-4 border rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium">Select Plan</label>
                    <Select
                      value={item.priceId}
                      onValueChange={(value) =>
                        handleItemChange(index, "priceId", value)
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlans.map((plan) => (
                          <SelectItem
                            key={plan.id}
                            value={plan.id}
                            disabled={subscriptionItems.some(
                              (item, i) =>
                                i !== index && item.priceId === plan.id
                            )}
                          >
                            {plan.product.name} -{" "}
                            {(plan.unit_amount / 100).toFixed(2)}{" "}
                            {plan.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
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
                      disabled={isLoading || isProcessing}
                      className="mt-2"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    className="mt-8"
                    disabled={subscriptionItems.length === 1}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={handleAddItem}
                disabled={isLoading || isProcessing}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Plan
              </Button>
            </div>
          </ScrollArea>

          <div className="border-t mt-6 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Total excluding tax
                </span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="font-medium">
                  ${calculateSubtotal().toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Amount due</span>
                <span className="font-medium">
                  ${calculateSubtotal().toFixed(2)}
                </span>
              </div>
            </div>
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
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Update
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StripeTabs({ company }: StripeTabsProps) {
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false);
  const [isCreateSubscriptionOpen, setIsCreateSubscriptionOpen] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("payments");
  const [loadingTabs, setLoadingTabs] = useState<Record<string, boolean>>({
    payments: false,
    subscriptions: false,
    invoices: false,
  });
  const { toast } = useToast();

  // Update default payment method detection
  const defaultPaymentMethodId =
    subscriptionDetails?.customer?.invoice_settings?.default_payment_method;

  const fetchData = async (tabToLoad?: string) => {
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
  };

  // Load data when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (!subscriptionDetails || !paymentMethods.length) {
      fetchData(tab);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const now = Date.now();
    const cachedPaymentMethods = paymentMethodsCache.get(company.id);
    const cachedSubscriptionDetails = subscriptionDetailsCache.get(company.id);

    // If we have valid cached data, use it immediately
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
    } else {
      // Only fetch if we don't have valid cached data
      fetchData(activeTab);
    }
  }, [company.id]);

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
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
  };

  const handleSetDefault = async (paymentMethodId: string) => {
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
  };

  const handleUpdateSubscriptionItems = async (items: SubscriptionItem[]) => {
    if (!subscriptionDetails?.subscription?.id) return;

    try {
      setIsProcessing(true);

      // Get available plans first
      const plansResponse = await fetch("/api/stripe/plans");
      const plansData = await plansResponse.json();
      const availablePlans = plansData.plans || [];

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

      // Call your API to update the subscription
      await fetch(
        `/api/stripe/subscriptions/${subscriptionDetails.subscription.id}/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items }),
        }
      );

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
  };

  const handleCreateSubscription = async (items: SubscriptionItem[]) => {
    if (!company.stripe_customer_id) {
      toast({
        title: "Error",
        description: "Company is not properly configured with Stripe",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);

      // Create subscription with multiple items
      const result = await createSubscription({
        customerId: company.stripe_customer_id,
        items: items.map((item) => ({
          price: item.priceId,
          quantity: item.quantity,
        })),
      });

      // Close the dialog before fetching fresh data
      setIsCreateSubscriptionOpen(false);

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
  };

  const handleCancelSubscription = async () => {
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
  };

  const handlePauseSubscription = async () => {
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
  };

  const handleResumeSubscription = async () => {
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
  };

  const handleSharePaymentLink = async () => {
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
  };

  const handleCreateOneTimeInvoice = async () => {
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
  };

  const handleExcludeFromAutoCancellation = async () => {
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
  };

  const [isUpdateSubscriptionOpen, setIsUpdateSubscriptionOpen] =
    useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);

  const handlePaymentMethodSuccess = async () => {
    setIsPaymentMethodsOpen(false);
    await fetchData();
  };

  const renderSubscriptionActions = () => {
    const subscription = subscriptionDetails?.subscription;
    const isCanceled = subscription?.status === "canceled";
    const hasNoSubscription = !subscription;

    if (hasNoSubscription || isCanceled) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {isCanceled ? (
              <div className="flex items-center justify-between">
                <span>Canceled Subscription</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateSubscriptionOpen(true)}
                  disabled={isProcessing}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Subscription
                </Button>
              </div>
            ) : (
              <>
                <span>No Active Subscription</span>
                <Button
                  onClick={() => setIsCreateSubscriptionOpen(true)}
                  disabled={isProcessing}
                  className="mt-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Subscription
                </Button>
              </>
            )}
          </h3>
          <CreateSubscriptionDialog
            onSubscribe={handleCreateSubscription}
            isOpen={isCreateSubscriptionOpen}
            onOpenChange={setIsCreateSubscriptionOpen}
            isProcessing={isProcessing}
          />
          {isCanceled && (
            <div className="text-sm text-muted-foreground mt-2">
              <div>
                Canceled on{" "}
                {new Date(subscription.canceled_at * 1000).toLocaleDateString()}
              </div>
              {subscription.cancel_at && (
                <div>
                  Access until{" "}
                  {new Date(subscription.cancel_at * 1000).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    const isPaused = subscription.status === "paused";
    const totalAmount = subscription.items.reduce(
      (sum: number, item: any) =>
        sum + (item.price.unit_amount * item.quantity || 0),
      0
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">
              Subscription Status: {subscription.status}
            </h3>
            <div className="text-sm text-muted-foreground">
              <div>
                Started{" "}
                {new Date(subscription.created * 1000).toLocaleDateString()}
              </div>
              <div>
                Next invoice $
                {(
                  (subscriptionDetails?.upcoming_invoice?.amount_due ??
                    subscriptionDetails?.subscription?.items?.reduce(
                      (sum: number, item: any) =>
                        sum +
                        (item.price?.unit_amount ?? 0) * (item.quantity ?? 1),
                      0
                    )) / 100
                ).toFixed(2)}{" "}
                on{" "}
                {new Date(
                  subscription.current_period_end * 1000
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
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
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Repeat className="mr-2 h-4 w-4" />
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
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                Resume Subscription
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Tabs
        defaultValue={activeTab}
        className="w-full"
        onValueChange={handleTabChange}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger
            value="subscriptions"
            className="flex items-center gap-2"
          >
            <Repeat className="h-4 w-4" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Payment Methods</h3>
              <Button
                onClick={() => setIsPaymentMethodsOpen(true)}
                variant="outline"
              >
                Add Payment Method
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              {loadingTabs.payments ? (
                <div className="flex justify-center items-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : paymentMethods.length > 0 ? (
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between px-4 py-3 border rounded-lg hover:bg-muted/50 transition-colors group"
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
                <div className="text-center py-6">
                  <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold">
                    No payment methods
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Add a payment method to process payments and subscriptions.
                  </p>
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card className="relative h-[calc(100vh-12rem)] flex flex-col overflow-hidden border-none">
            <div className="flex items-center justify-between px-8 py-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
              <div className="space-y-1.5">
                <h3 className="text-2xl font-semibold tracking-tight">
                  Active Subscriptions
                </h3>
                <p className="text-sm text-muted-foreground">
                  Manage your subscription plans and billing
                </p>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-8 py-6 space-y-8">
                {loadingTabs.subscriptions ? (
                  <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Loading subscription details...
                    </p>
                  </div>
                ) : (
                  <>
                    {renderSubscriptionActions()}
                    {subscriptionDetails?.subscription && (
                      <>
                        <div className="rounded-xl border bg-card shadow-sm">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[40%] font-semibold">
                                  Plan
                                </TableHead>
                                <TableHead className="font-semibold">
                                  Status
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
                              {subscriptionDetails?.subscription?.items?.map(
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
                                        {
                                          subscriptionDetails.subscription
                                            .status
                                        }
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      $
                                      {(
                                        (item.price.unit_amount || 0) / 100
                                      ).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {new Date(
                                        subscriptionDetails.subscription
                                          .current_period_end * 1000
                                      ).toLocaleDateString()}
                                    </TableCell>
                                  </TableRow>
                                )
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="rounded-xl border bg-card shadow-sm p-6">
                          <div className="space-y-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Subtotal
                              </span>
                              <span className="font-medium">
                                $
                                {(
                                  subscriptionDetails.subscription.items.reduce(
                                    (sum: number, item: any) =>
                                      sum +
                                      (item.price.unit_amount * item.quantity ||
                                        0),
                                    0
                                  ) / 100
                                ).toFixed(2)}
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
                                  {(
                                    subscriptionDetails.subscription.items.reduce(
                                      (sum: number, item: any) =>
                                        sum +
                                        (item.price.unit_amount *
                                          item.quantity || 0),
                                      0
                                    ) / 100
                                  ).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Invoices</h3>
              <Button
                onClick={() => fetchData("invoices")}
                variant="outline"
                disabled={loadingTabs.invoices}
              >
                {loadingTabs.invoices ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="mr-2 h-4 w-4" />
                )}
                Load Invoices
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              {loadingTabs.invoices ? (
                <div className="flex justify-center items-center h-[300px]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : subscriptionDetails?.invoices?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptionDetails?.invoices?.map((invoice: any) => (
                      <TableRow key={invoice.id}>
                        <TableCell>{invoice.number}</TableCell>
                        <TableCell>
                          {new Date(
                            invoice.created * 1000
                          ).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          ${((invoice.amount_due || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>{invoice.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6">
                  <Receipt className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold">
                    No invoices found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Click the Load Invoices button to fetch your invoice
                    history.
                  </p>
                </div>
              )}
            </ScrollArea>
          </Card>
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
    </>
  );
}
