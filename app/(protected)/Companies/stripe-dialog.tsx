"use client";

import { useState } from "react";
import { Company, PaymentMethod } from "./types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2, Plus, Trash } from "lucide-react";

interface StripeDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StripeDialog({
  company,
  open,
  onOpenChange,
}: StripeDialogProps) {
  const [activeTab, setActiveTab] = useState("payment-methods");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAddPaymentMethod = async () => {
    // TODO: Implement Stripe Elements or Stripe Checkout for adding payment methods
    toast({
      title: "Coming Soon",
      description: "Payment method addition will be implemented soon",
    });
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    // TODO: Implement payment method removal
    toast({
      title: "Coming Soon",
      description: "Payment method removal will be implemented soon",
    });
  };

  const handleUpdateSubscription = async () => {
    // TODO: Implement subscription management
    toast({
      title: "Coming Soon",
      description: "Subscription management will be implemented soon",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Stripe Settings - {company.name}</DialogTitle>
          <DialogDescription>
            Manage payment methods and subscriptions
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>

          <TabsContent value="payment-methods">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Payment Methods</h3>
                <Button onClick={handleAddPaymentMethod}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment Method
                </Button>
              </div>

              {/* Example Payment Method Card */}
              {company.stripe_payment_method_id && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Card ending in ****</p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        handleRemovePaymentMethod(
                          company.stripe_payment_method_id!
                        )
                      }
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {!company.stripe_payment_method_id && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Payment Methods</CardTitle>
                    <CardDescription>
                      Add a payment method to manage subscriptions
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="subscription">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Subscription Details</h3>
                <Button onClick={handleUpdateSubscription}>
                  {company.stripe_subscription_id ? "Update" : "Add"}{" "}
                  Subscription
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Current Subscription</span>
                    {company.stripe_subscription_id ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">No Subscription</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {company.stripe_subscription_id ? (
                    <div className="space-y-2">
                      <p>
                        Amount: {formatCurrency(company.subscription_amount)}
                      </p>
                      <p>Subscription ID: {company.stripe_subscription_id}</p>
                    </div>
                  ) : (
                    <p>No active subscription</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
