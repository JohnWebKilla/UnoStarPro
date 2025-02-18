import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NotificationMessage } from "../types";
import Image from "next/image";

interface NotificationDialogProps {
  message: NotificationMessage;
  onDismiss: (id: string) => void;
}

export const NotificationDialog = ({
  message,
  onDismiss,
}: NotificationDialogProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleDismiss = () => {
    setIsOpen(false);
    onDismiss(message.id);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && message.dismissible) {
      handleDismiss();
    } else {
      setIsOpen(open);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{message.title}</DialogTitle>
          {message.image && (
            <div className="mt-4 flex justify-center">
              <Image
                src={message.image}
                alt=""
                width={200}
                height={200}
                className="rounded-lg object-cover"
              />
            </div>
          )}
          <DialogDescription className="mt-4">
            {message.content}
          </DialogDescription>
        </DialogHeader>
        {message.dismissible && (
          <DialogFooter>
            <Button onClick={handleDismiss}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
