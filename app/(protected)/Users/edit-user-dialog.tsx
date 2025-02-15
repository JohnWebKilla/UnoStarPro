"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User } from "./types";
import { UserForm } from "./user-form";
import { useCallback } from "react";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | undefined;
  onSuccess: (user: User) => Promise<void>;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditUserDialogProps) {
  const handleSubmit = useCallback(
    async (data: User) => {
      try {
        await onSuccess(data);
        onOpenChange(false);
      } catch (error) {
        console.error("Error submitting form:", error);
      }
    },
    [onSuccess, onOpenChange]
  );

  // Don't render if no user
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-[425px]"
      >
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <UserForm
            key={open ? user.id : "closed"} // Force remount when dialog opens/closes
            user={user}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
