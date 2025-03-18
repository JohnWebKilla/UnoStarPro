import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Company } from "./types";

interface PaymentStatusBadgeProps {
  company: Company;
}

export function PaymentStatusBadge({ company }: PaymentStatusBadgeProps) {
  const hasStripe = !!company.stripe_customer_id;
  const hasPaymentMethod = !!company.stripe_payment_method_id;
  const hasSubscription = !!company.stripe_subscription_id;

  // If no Stripe account
  if (!hasStripe) {
    return (
      <Badge variant="outline" className="h-6">
        Not Connected
      </Badge>
    );
  }

  // If has subscription but no payment method, show "Auto-Pay Disabled"
  // This is more accurate than "No Payment" if they have a subscription
  if (hasSubscription && !hasPaymentMethod) {
    return (
      <Badge variant="secondary" className="h-6">
        <AlertCircle className="mr-1 h-3 w-3" />
        Auto-Pay Disabled
      </Badge>
    );
  }

  // If no payment method (but has Stripe)
  if (!hasPaymentMethod) {
    return (
      <Badge variant="destructive" className="h-6">
        <AlertCircle className="mr-1 h-3 w-3" />
        No Payment Method
      </Badge>
    );
  }

  // Has Stripe and payment method
  return (
    <Badge variant="success" className="h-6">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      Connected
    </Badge>
  );
}
