"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User } from "./columns";
import { UserForm } from "./user-form";
import { useState, useEffect, useCallback, useRef } from "react";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Reset submitting state when dialog closes
  useEffect(() => {
    if (!open) {
      timeoutRef.current = setTimeout(() => {
        setIsSubmitting(false);
      }, 300);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (data: User) => {
      if (isSubmitting) return;

      try {
        setIsSubmitting(true);
        await onSuccess(data);
        onOpenChange(false);
      } catch (error) {
        console.error("Error submitting form:", error);
      } finally {
        // Don't reset isSubmitting here, let the effect handle it
      }
    },
    [isSubmitting, onSuccess, onOpenChange]
  );

  const handleClose = useCallback(
    (open: boolean) => {
      if (isSubmitting) return;
      onOpenChange(open);
    },
    [isSubmitting, onOpenChange]
  );

  // Don't render if no user
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
        }}
        className="sm:max-w-[425px]"
      >
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <UserForm
            ref={formRef}
            key={user.id} // Force form reset when user changes
            user={user}
            onSubmit={handleSubmit}
            onCancel={() => handleClose(false)}
            disabled={isSubmitting}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
