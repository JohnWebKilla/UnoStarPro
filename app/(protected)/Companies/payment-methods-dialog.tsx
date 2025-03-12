"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Company } from "./types";
import {
  getCompanyPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  getStripeSubscriptionDetails,
} from "./stripe-actions";
import { CreditCard, Loader2, Star, Trash } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { AddPaymentMethod } from "./components/add-payment-method";

interface PaymentMethodsDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentMethodsDialog({
  company,
  open,
  onOpenChange,
}: PaymentMethodsDialogProps) {
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<
    string | null
  >(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPaymentMethods();
    }
  }, [open, company.id]);

  const loadPaymentMethods = async () => {
    try {
      setIsLoading(true);
      const [methods, details] = await Promise.all([
        getCompanyPaymentMethods(company.id),
        getStripeSubscriptionDetails(company.id),
      ]);
      setPaymentMethods(methods);
      setDefaultPaymentMethodId(
        details.customer?.invoice_settings?.default_payment_method || null
      );
    } catch (error) {
      console.error("Error loading payment methods:", error);
      toast({
        title: "Error",
        description: "Failed to load payment methods",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    try {
      setIsProcessing(true);
      await removePaymentMethod(company.id, paymentMethodId);
      await loadPaymentMethods();
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
    try {
      setIsProcessing(true);
      await setDefaultPaymentMethod(company.id, paymentMethodId);
      await loadPaymentMethods();
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

  const handleAddPaymentMethodSuccess = async () => {
    setShowAddPaymentMethod(false);
    await loadPaymentMethods();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Payment Methods</DialogTitle>
            <DialogDescription>
              Manage your company's payment methods for subscriptions and
              invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : paymentMethods.length > 0 ? (
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <div>
                        <p className="font-medium">•••• {method.card.last4}</p>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.card.exp_month}/{method.card.exp_year}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={
                          method.id === defaultPaymentMethodId || isProcessing
                        }
                      >
                        <Star
                          className={cn("h-4 w-4", {
                            "fill-yellow-400 text-yellow-400":
                              method.id === defaultPaymentMethodId,
                          })}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePaymentMethod(method.id)}
                        disabled={
                          method.id === defaultPaymentMethodId || isProcessing
                        }
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
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

            <Button
              className="w-full"
              onClick={() => setShowAddPaymentMethod(true)}
              disabled={isLoading || isProcessing}
            >
              Add Payment Method
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddPaymentMethod
        companyId={company.id}
        open={showAddPaymentMethod}
        onOpenChange={setShowAddPaymentMethod}
        onSuccess={handleAddPaymentMethodSuccess}
      />
    </>
  );
}
