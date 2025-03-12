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
} from "../stripe-actions";
import { AddPaymentMethod } from "../components/add-payment-method";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Receipt,
  Repeat,
  Star,
  Loader2,
  Trash,
  ChevronRight,
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

interface StripeTabsProps {
  company: Company;
}

export function StripeTabs({ company }: StripeTabsProps) {
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isPaymentMethodsOpen, setIsPaymentMethodsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const defaultPaymentMethodId =
    subscriptionDetails?.customer?.invoice_settings?.default_payment_method;

  const fetchData = async () => {
    if (company.stripe_customer_id) {
      setIsLoading(true);
      try {
        const [details, methods] = await Promise.all([
          getStripeSubscriptionDetails(company.id),
          getCompanyPaymentMethods(company.id),
        ]);
        setSubscriptionDetails(details);
        setPaymentMethods(methods);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load payment methods",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

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
      await removePaymentMethod(company.id, paymentMethodId);
      await fetchData();
      toast({
        title: "Success",
        description: "Payment method removed successfully",
      });
    } catch (error) {
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
    if (paymentMethodId === defaultPaymentMethodId) {
      return; // Already default
    }

    try {
      setIsProcessing(true);
      await setDefaultPaymentMethod(company.id, paymentMethodId);
      await fetchData();
      toast({
        title: "Success",
        description: "Default payment method updated successfully",
      });
    } catch (error) {
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

  useEffect(() => {
    fetchData();
  }, [company]);

  const handlePaymentMethodSuccess = async () => {
    setIsPaymentMethodsOpen(false);
    await fetchData();
  };

  return (
    <>
      <Tabs defaultValue="payments" className="w-full">
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
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
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
                              <div className="text-[#1434CB] font-bold text-sm">
                                Visa
                              </div>
                            )}
                            {method.card.brand === "mastercard" && (
                              <div className="text-[#1434CB] font-bold text-sm">
                                Mastercard
                              </div>
                            )}
                            {method.card.brand === "amex" && (
                              <div className="text-[#1434CB] font-bold text-sm">
                                Amex
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                •••• {method.card.last4}
                              </span>
                              {method.id === defaultPaymentMethodId && (
                                <span className="text-sm text-muted-foreground">
                                  (Default)
                                </span>
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
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Active Subscriptions</h3>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Next Bill</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptionDetails?.subscription?.items.data.map(
                    (item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.price.nickname || item.price.id}
                        </TableCell>
                        <TableCell>
                          {subscriptionDetails.subscription.status}
                        </TableCell>
                        <TableCell>
                          ${((item.price.unit_amount || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
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
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Recent Invoices</h3>
            <ScrollArea className="h-[400px]">
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
                        {new Date(invoice.created * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        ${((invoice.amount_due || 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>{invoice.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
    </>
  );
}
