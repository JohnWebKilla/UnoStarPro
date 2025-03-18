import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Company } from "../types";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { XCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

// Add interface for toggle status options
interface ToggleStatusOptions {
  cancelSubscription?: boolean;
  cancellationType?: "now" | "end_period";
  issueRefund?: boolean;
}

interface DeactivationDialogProps {
  company: Company;
  onToggleStatus: (options?: ToggleStatusOptions) => Promise<void>;
  onCancel: () => void;
  open: boolean;
}

export function DeactivationDialog({
  company,
  onToggleStatus,
  onCancel,
  open,
}: DeactivationDialogProps) {
  const [isActivate, setIsActivate] = useState(company.status !== "active");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelSubscription, setCancelSubscription] = useState(false);
  const [cancellationType, setCancellationType] = useState<
    "now" | "end_period"
  >("end_period");
  const [issueRefund, setIssueRefund] = useState(false);

  const hasSubscription = !!company.stripe_subscription_id;

  const handleDeactivate = async () => {
    if (hasSubscription && cancelSubscription) {
      // Show confirmation dialog for subscription cancellation
      setShowConfirmation(true);
    } else {
      // Just deactivate without cancellation
      handleConfirmDeactivate();
    }
  };

  const handleConfirmDeactivate = async () => {
    try {
      setLoading(true);

      // Create options object to pass to onToggleStatus if needed
      const options: ToggleStatusOptions = {};

      if (hasSubscription && cancelSubscription) {
        options.cancelSubscription = true;
        options.cancellationType = cancellationType;

        if (cancellationType === "now" && issueRefund) {
          options.issueRefund = true;
        }
      }

      // Log options for debugging
      console.log("Deactivation options:", options);

      // Pass options to the toggle status function
      await onToggleStatus(options);
    } catch (error) {
      console.error("Error during deactivation:", error);
    } finally {
      setLoading(false);
    }
  };

  // For activation, we don't need the cancellation options
  const handleActivate = async () => {
    try {
      setLoading(true);
      await onToggleStatus();
    } catch (error) {
      console.error("Error during activation:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isActivate ? "Activate Company" : "Deactivate Company"}
            </DialogTitle>
            <DialogDescription>
              {isActivate
                ? "This will reactivate the company and restore access to all its services."
                : "This will deactivate the company and restrict access to its services."}
            </DialogDescription>
          </DialogHeader>

          {!isActivate && hasSubscription && (
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cancel-subscription"
                  checked={cancelSubscription}
                  onCheckedChange={(checked) =>
                    setCancelSubscription(checked === true)
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="cancel-subscription"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Cancel subscription
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    This will cancel the Stripe subscription for this company.
                  </p>
                </div>
              </div>

              {cancelSubscription && (
                <div className="pl-6 space-y-4 border-l-2 border-muted">
                  <RadioGroup
                    defaultValue="end_period"
                    value={cancellationType}
                    onValueChange={(value) =>
                      setCancellationType(value as "now" | "end_period")
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="end_period" id="end_period" />
                      <Label htmlFor="end_period">
                        Cancel at end of billing period
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="now" id="now" />
                      <Label htmlFor="now">Cancel immediately</Label>
                    </div>
                  </RadioGroup>

                  {cancellationType === "now" && (
                    <div className="pl-6 pt-2 space-y-4 border-l-2 border-muted">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="issue-refund"
                          checked={issueRefund}
                          onCheckedChange={(checked) =>
                            setIssueRefund(checked === true)
                          }
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor="issue-refund"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Issue prorated refund
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Customer will receive a refund for unused portion of
                            billing period.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-md bg-amber-50 p-4 mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle
                      className="h-5 w-5 text-amber-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">
                      Subscription Notice
                    </h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>
                        Deactivating a company doesn't automatically cancel its
                        subscription. If you want to stop billing, make sure to
                        check the "Cancel subscription" option.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            {isActivate ? (
              <Button onClick={handleActivate} disabled={loading}>
                {loading ? "Processing..." : "Activate Company"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleDeactivate}
                disabled={loading}
              >
                {loading ? "Processing..." : "Deactivate Company"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm Subscription Cancellation
            </AlertDialogTitle>
            <div className="text-sm text-muted-foreground mt-2 space-y-4">
              <p>
                You are about to cancel this company's subscription
                {cancellationType === "now"
                  ? " immediately"
                  : " at the end of the current billing period"}
                {cancellationType === "now" && issueRefund
                  ? " and issue a refund"
                  : ""}
                .
              </p>
              <Separator />
              <p>
                This action will affect billing and cannot be automatically
                reversed.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeactivate}>
              Confirm Deactivation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
