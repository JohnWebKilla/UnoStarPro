import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";
import { syncStripeProduct } from "../stripe-actions";
import { Driver } from "../types";

interface SyncStripeButtonProps {
  driver: Driver;
  onSync?: () => Promise<void>;
}

export function SyncStripeButton({ driver, onSync }: SyncStripeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const handleSync = async () => {
    try {
      // Check if this driver was synced recently (within 10 seconds)
      const currentTime = Date.now();
      if (lastSyncTime && currentTime - lastSyncTime < 10000) {
        toast({
          title: "Info",
          description:
            "This driver was synced recently. Please wait a moment before syncing again.",
        });
        return;
      }

      setIsLoading(true);
      setLastSyncTime(currentTime);

      await syncStripeProduct(driver.id);
      if (onSync) {
        await onSync();
      }

      toast({
        title: "Success",
        description: "Driver synced with Stripe successfully",
      });
    } catch (error) {
      console.error("Error syncing driver with Stripe:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to sync with Stripe",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);

      // After 10 seconds, allow syncing again
      setTimeout(() => {
        setLastSyncTime(null);
      }, 10000);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isLoading || lastSyncTime !== null}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          {driver.stripe_product_id ? "Sync with Stripe" : "Connect to Stripe"}
        </>
      )}
    </Button>
  );
}
