import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotificationMessage } from "../types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface NotificationDialogProps {
  message: NotificationMessage;
  onDismiss: (id: string) => void;
}

export const NotificationDialog = ({
  message,
  onDismiss,
}: NotificationDialogProps) => {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleClose = () => {
    setIsOpen(false);
  };

  const getDialogColor = () => {
    switch (message.type) {
      case "success":
        return "bg-green-50 dark:bg-green-900/10";
      case "error":
        return "bg-red-50 dark:bg-red-900/10";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900/10";
      default:
        return "bg-blue-50 dark:bg-blue-900/10";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "max-w-lg overflow-hidden border-0 shadow-lg",
          getDialogColor()
        )}
      >
        <DialogHeader className="relative border-b border-border/50 pb-4">
          <DialogTitle className="text-lg font-semibold pr-8">
            {message.title}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 absolute -top-1 right-0 hover:bg-background/10 rounded-full"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {message.image && (
            <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-background/50">
              <Image
                src={message.image}
                alt=""
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
              />
            </div>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message.content}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
