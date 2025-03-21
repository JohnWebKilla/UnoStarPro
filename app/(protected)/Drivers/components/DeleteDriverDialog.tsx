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
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface DeleteDriverDialogProps {
  driverId: number;
  driverName: string;
  onDriverDeleted: () => void;
}

export function DeleteDriverDialog({
  driverId,
  driverName,
  onDriverDeleted,
}: DeleteDriverDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Use the API endpoint to delete the driver
      const response = await fetch(`/api/drivers/${driverId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Error deleting driver:", data.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to delete driver",
        });
        return;
      }

      // Success notification
      toast({
        title: "Success",
        description: "Driver deleted successfully",
      });

      // Close dialog and refresh drivers list
      setOpen(false);
      onDriverDeleted();
    } catch (err) {
      console.error("Error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-600">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Driver</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {driverName}? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Driver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
