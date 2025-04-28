"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncDriverWithStripeAction } from "../server-actions";
import { Loader2, RefreshCw } from "lucide-react";
import { useDrivers } from "./DriversClientProvider";
import { Driver } from "../types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SyncDriverButtonProps {
  driver: Driver;
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function SyncDriverButton({
  driver,
  variant = "outline",
  size = "sm",
  className = "",
}: SyncDriverButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { refreshDrivers } = useDrivers();

  const handleSync = async () => {
    setIsLoading(true);

    try {
      const result = await syncDriverWithStripeAction(Number(driver.id));

      if (result.success) {
        toast.success(result.message);
        await refreshDrivers();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error during sync:", error);
      toast.error(
        "Failed to sync driver with Stripe. Please check the console for details."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const buttonContent = isLoading ? (
    <Loader2
      className={
        size === "icon" ? "h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"
      }
    />
  ) : (
    <RefreshCw className={size === "icon" ? "h-4 w-4" : "mr-2 h-4 w-4"} />
  );

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isLoading}
      className={className}
    >
      {buttonContent}
      {size !== "icon" && (isLoading ? "Syncing..." : "Sync with Stripe")}
    </Button>
  );

  if (size === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>Sync driver with Stripe</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
