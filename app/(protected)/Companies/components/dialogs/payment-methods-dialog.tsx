import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Company, PaymentMethod } from "../../lib/types";
import {
  getCompanyPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from "../../actions/actions";
import { CreditCard, Loader2, Star, Trash } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPaymentMethods();
    }
  }, [open, company.id]);

  const loadPaymentMethods = async () => {
    try {
      setIsLoading(true);
      const methods = await getCompanyPaymentMethods(company.id);
      setPaymentMethods(methods);
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

  const handleAddPaymentMethod = async () => {
    // This would typically integrate with Stripe Elements or Stripe Checkout
    // For now, we'll just show a toast
    toast({
      title: "Not Implemented",
      description:
        "Payment method addition would be handled through Stripe Elements",
    });
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    try {
      await deletePaymentMethod(company.id, paymentMethodId);
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
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Payment Methods</DialogTitle>
          <DialogDescription>
            Manage payment methods for {company.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            onClick={handleAddPaymentMethod}
            className="w-full"
            variant="outline"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : paymentMethods.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No payment methods found
            </p>
          ) : (
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <CreditCard className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">
                        {method.card?.brand} •••• {method.card?.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.card?.exp_month}/{method.card?.exp_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(method.id)}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemovePaymentMethod(method.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
