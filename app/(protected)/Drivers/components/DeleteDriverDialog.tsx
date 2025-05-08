import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteDriverDialogProps {
  driverId: string;
  driverName: string;
  onDriverDeleted: () => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteDriverDialog({
  driverId,
  driverName,
  onDriverDeleted,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DeleteDriverDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/drivers/${driverId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the response data
      const data = await response.json();

      // Use the returned name or fall back to the original name
      const displayName =
        data.deletedDriverName || driverName || "Unknown driver";

      toast.error(`${displayName} has been deleted.`);

      // Close dialog and refresh drivers list
      setInternalOpen(false);
      await onDriverDeleted();
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to delete driver. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Trash className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Driver</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {driverName}? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
