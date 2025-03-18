import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Company } from "./types";
import { cn } from "@/lib/utils";

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
      <Badge
        variant="outline"
        className="h-6 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
      >
        Not Connected
      </Badge>
    );
  }

  // If has subscription but no payment method, show "Auto-Pay Disabled"
  // This is more accurate than "No Payment" if they have a subscription
  if (hasSubscription && !hasPaymentMethod) {
    return (
      <Badge
        variant="secondary"
        className="h-6 bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 hover:bg-yellow-500/20 dark:hover:bg-yellow-500/30 border-yellow-500/20 dark:border-yellow-500/30"
      >
        <AlertCircle className="mr-1 h-3 w-3" />
        Auto-Pay Disabled
      </Badge>
    );
  }

  // If no payment method (but has Stripe)
  if (!hasPaymentMethod) {
    return (
      <Badge
        variant="destructive"
        className="h-6 bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20 dark:hover:bg-red-500/30 border-red-500/20 dark:border-red-500/30"
      >
        <AlertCircle className="mr-1 h-3 w-3" />
        No Payment Method
      </Badge>
    );
  }

  // Has Stripe and payment method
  return (
    <Badge
      variant="success"
      className="h-6 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 hover:bg-green-500/20 dark:hover:bg-green-500/30 border-green-500/20 dark:border-green-500/30"
    >
      <CheckCircle2 className="mr-1 h-3 w-3" />
      Connected
    </Badge>
  );
}
