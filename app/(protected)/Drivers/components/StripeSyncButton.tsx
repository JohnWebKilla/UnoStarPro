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
import { toast } from "sonner";
import {
  syncStripeWithNameMatchingAction,
  approveStripeMatchAction,
} from "../server-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { NameMatchSuggestion } from "../types";
import { useDrivers } from "./DriversProvider";
import { Progress } from "@/components/ui/progress";

interface SyncProgress {
  stage: "fetching" | "matching" | "creating" | "complete";
  message: string;
  progress: number;
  total: number;
  currentItem?: string;
}

export function StripeSyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<NameMatchSuggestion[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const { refreshDrivers } = useDrivers();

  const handleSync = async () => {
    setIsLoading(true);
    setSyncProgress({
      stage: "fetching",
      message: "Fetching drivers and Stripe products...",
      progress: 0,
      total: 100,
    });

    try {
      const result = await syncStripeWithNameMatchingAction();

      if (result.success) {
        if (result.suggestions && result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
          setShowSuggestions(true);
          toast.success(`Found ${result.suggestions.length} potential matches`);
        } else {
          toast.success(result.message);
        }
        await refreshDrivers();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error during sync:", error);
      toast.error(
        "Failed to sync with Stripe. Please check the console for details."
      );
    } finally {
      setIsLoading(false);
      setSyncProgress(null);
    }
  };

  const handleApproveMatch = async (
    driverId: number,
    stripeProductId: string,
    driverName: string
  ) => {
    const matchButton = document.querySelector(
      `[data-match-id="${driverId}-${stripeProductId}"]`
    );
    if (matchButton) {
      matchButton.setAttribute("disabled", "true");
      matchButton.innerHTML =
        '<span class="animate-spin">↻</span> Approving...';
    }

    try {
      const result = await approveStripeMatchAction(driverId, stripeProductId);

      if (result.success) {
        toast.success(result.message);
        setSuggestions((prev) => {
          const newSuggestions = prev.filter(
            (s) =>
              !(
                s.dbDriver.id === driverId &&
                s.stripeProduct.id === stripeProductId
              )
          );
          return newSuggestions;
        });
        if (suggestions.length === 1) {
          setShowSuggestions(false);
        }
        await refreshDrivers();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error approving match:", error);
      toast.error("Failed to approve match. Please try again.");
    } finally {
      if (matchButton) {
        matchButton.removeAttribute("disabled");
        matchButton.innerHTML = "Approve Match";
      }
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          onClick={handleSync}
          disabled={isLoading}
          className="relative"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync with Stripe
            </>
          )}
        </Button>

        {syncProgress && (
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm">
              <span>{syncProgress.message}</span>
              <span>
                {Math.round((syncProgress.progress / syncProgress.total) * 100)}
                %
              </span>
            </div>
            <Progress
              value={(syncProgress.progress / syncProgress.total) * 100}
            />
            {syncProgress.currentItem && (
              <p className="text-xs text-muted-foreground truncate">
                {syncProgress.currentItem}
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Similar Name Matches Found</DialogTitle>
            <DialogDescription>
              We found some potential matches between your database drivers and
              Stripe products. Please review and approve the matches that are
              correct.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {suggestions.length === 0 ? (
              <Card>
                <CardContent className="py-4 text-center text-muted-foreground">
                  No more matches to review.
                </CardContent>
              </Card>
            ) : (
              suggestions.map((suggestion) => (
                <Card
                  key={`${suggestion.dbDriver.id}-${suggestion.stripeProduct.id}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Potential Match</CardTitle>
                    <CardDescription>
                      Similarity Score:{" "}
                      <Badge
                        variant={
                          suggestion.similarity > 0.8 ? "default" : "secondary"
                        }
                      >
                        {Math.round(suggestion.similarity * 100)}%
                      </Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium">Database Driver</h4>
                        <p className="text-sm text-muted-foreground">
                          {suggestion.dbDriver.name}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium">Stripe Product</h4>
                        <p className="text-sm text-muted-foreground">
                          {suggestion.stripeProduct.name}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      data-match-id={`${suggestion.dbDriver.id}-${suggestion.stripeProduct.id}`}
                      onClick={() =>
                        handleApproveMatch(
                          suggestion.dbDriver.id,
                          suggestion.stripeProduct.id,
                          suggestion.dbDriver.name
                        )
                      }
                    >
                      Approve Match
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
