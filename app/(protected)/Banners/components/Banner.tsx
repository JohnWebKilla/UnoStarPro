import React, { useEffect, useState } from "react";
import { NotificationMessage } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import { cn } from "@/lib/utils";

interface BannerProps {
  message: NotificationMessage;
  onDismiss: (id: string) => void;
}

export const Banner = ({ message, onDismiss }: BannerProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const { t } = useTranslation();
  const [translatedContent, setTranslatedContent] = useState({
    title: message.title,
    content: message.content,
  });

  useEffect(() => {
    if (message.duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss(message.id);
      }, message.duration);
      return () => clearTimeout(timer);
    }
  }, [message.duration, message.id, onDismiss]);

  const getBannerColor = () => {
    switch (message.type) {
      case "success":
        return "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300";
      case "error":
        return "bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300";
      case "warning":
        return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-300";
      default:
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300";
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss(message.id);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="relative w-full"
        >
          <div
            className={cn(
              getBannerColor(),
              "border-b px-4 py-2 flex items-center justify-between shadow-sm"
            )}
          >
            <div className="flex items-center space-x-3 flex-grow">
              {message.image && (
                <div className="flex-shrink-0">
                  <Image
                    src={message.image}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <p className="font-medium">{translatedContent.title}</p>
                <span className="text-sm">{translatedContent.content}</span>
              </div>
            </div>
            {message.dismissible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
