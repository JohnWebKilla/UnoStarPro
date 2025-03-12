"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;

interface AddPaymentMethodProps {
  companyId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function AddPaymentMethodForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Payment method added successfully",
        });
        onSuccess();
      }
    } catch (error) {
      console.error("Error adding payment method:", error);
      toast({
        title: "Error",
        description: "Failed to add payment method",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Add Payment Method"
        )}
      </Button>
    </form>
  );
}

export function AddPaymentMethod({
  companyId,
  open,
  onOpenChange,
  onSuccess,
}: AddPaymentMethodProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch setup intent when dialog opens
  const getSetupIntent = async () => {
    if (!STRIPE_PUBLISHABLE_KEY) {
      setError("Stripe is not properly configured. Please contact support.");
      return;
    }

    try {
      const response = await fetch("/api/stripe/setup-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create setup intent");
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
      setError(null);
    } catch (error) {
      console.error("Error creating setup intent:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    }
  };

  // Get setup intent when dialog opens
  if (open && !clientSecret && !error) {
    getSetupIntent();
  }

  const options: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: "stripe" as const,
        },
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a new payment method to your account.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !stripePromise ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Stripe is not properly configured. Please contact support.
            </AlertDescription>
          </Alert>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={options}>
            <AddPaymentMethodForm onSuccess={onSuccess} />
          </Elements>
        ) : (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
