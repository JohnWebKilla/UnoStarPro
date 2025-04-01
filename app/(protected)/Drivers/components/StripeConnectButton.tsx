"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Driver,
  SUBSCRIPTION_FREQUENCY_OPTIONS,
  SubscriptionFrequency,
} from "../types";
import {
  createStripeConnectAccountAction,
  createOrUpdateDriverProductAction,
  createCheckoutSessionAction,
  getStripeAccountStatusAction,
} from "../stripe-actions-client";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

interface StripeConnectButtonProps {
  driver: Driver;
  onUpdate: () => void;
  onSync: () => void;
  isLoading?: boolean;
}

export function StripeConnectButton({
  driver,
  onUpdate,
  onSync,
  isLoading = false,
}: StripeConnectButtonProps) {
  const [isDialogLoading, setIsDialogLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(
    driver.subscription_amount?.toString() || ""
  );
  const [frequency, setFrequency] = React.useState<SubscriptionFrequency>(
    driver.subscription_frequency || "monthly"
  );

  const handleStripeConnect = async () => {
    try {
      setIsDialogLoading(true);
      const accountLinkUrl = await createStripeConnectAccountAction(driver.id);
      if (accountLinkUrl) {
        window.location.href = accountLinkUrl;
      } else {
        throw new Error("Failed to get account link URL");
      }
    } catch (error) {
      console.error("Error creating Stripe Connect account:", error);
      toast.error("Failed to create Stripe Connect account");
    } finally {
      setIsDialogLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    try {
      setIsDialogLoading(true);

      if (!amount || isNaN(Number(amount))) {
        toast.error("Please enter a valid amount");
        return;
      }

      const updatedDriver = {
        ...driver,
        subscription_amount: Number(amount),
      };

      await createOrUpdateDriverProductAction(updatedDriver, frequency);
      toast.success("Product updated successfully");
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    } finally {
      setIsDialogLoading(false);
    }
  };

  const handleCreateCheckout = async () => {
    try {
      setIsDialogLoading(true);

      if (!driver.stripe_price_id) {
        toast.error("Please set up pricing first");
        return;
      }

      const checkoutUrl = await createCheckoutSessionAction(
        driver.id,
        driver.stripe_price_id
      );
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Failed to get checkout URL");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Failed to create checkout session");
    } finally {
      setIsDialogLoading(false);
    }
  };

  if (!driver.stripe_connect_account_id) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={handleStripeConnect}
          disabled={isDialogLoading || isLoading}
        >
          {isDialogLoading ? "Setting up..." : "Set up Stripe Connect"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSync}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            {driver.stripe_product_id ? "Update Pricing" : "Set up Pricing"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Driver Pricing</DialogTitle>
            <DialogDescription>
              Set the subscription amount and frequency for this driver.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-3"
                placeholder="Enter amount in USD"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="frequency" className="text-right">
                Frequency
              </Label>
              <Select
                value={frequency}
                onValueChange={(value: SubscriptionFrequency) =>
                  setFrequency(value)
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isDialogLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateProduct} disabled={isDialogLoading}>
              {isDialogLoading ? "Saving..." : "Save Changes"}
            </Button>
            {driver.stripe_price_id && (
              <Button
                variant="default"
                onClick={handleCreateCheckout}
                disabled={isDialogLoading}
              >
                Create Checkout
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="icon" onClick={onSync} disabled={isLoading}>
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
