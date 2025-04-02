import React, { useState, useEffect } from "react";
import { NotificationMessage } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Globe,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BannerProps {
  message: NotificationMessage;
  onDismiss: (id: string) => void;
  totalBanners: number;
  currentIndex: number;
}

const LANGUAGES = {
  en: "English",
  uz: "O'zbek",
  ru: "Русский",
} as const;

const ROTATION_INTERVAL = 5000; // Should match the interval in NotificationProvider

export function Banner({
  message,
  onDismiss,
  totalBanners,
  currentIndex,
}: BannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = (id: string) => {
    setIsVisible(false);
    onDismiss(id); // Call immediately, don't wait
  };

  console.log("Banner type:", message.type);

  const getBackgroundColor = () => {
    switch (message.type) {
      case "success":
        return "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300";
      case "error":
        return "bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300";
      case "warning":
        return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-300";
      case "info":
      default:
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300";
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ height: isVisible ? "48px" : 0, opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.1, ease: "easeInOut" }}
      className={cn(
        "border-b px-4 flex items-center justify-between shadow-sm relative overflow-hidden",
        getBackgroundColor()
      )}
    >
      <div className="flex items-center space-x-3 flex-grow min-w-0">
        <div className="flex-shrink-0">
          {message.type === "success" && <CheckCircle2 className="h-5 w-5" />}
          {message.type === "error" && <AlertCircle className="h-5 w-5" />}
          {message.type === "warning" && <AlertTriangle className="h-5 w-5" />}
          {message.type === "info" && <Info className="h-5 w-5" />}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-medium truncate">{message.title}</p>
          <span className="text-current opacity-40 flex-shrink-0">•</span>
          <p className="text-sm truncate">{message.content}</p>
        </div>
      </div>
      {message.dismissible && (
        <button
          onClick={() => handleDismiss(message.id)}
          className="h-7 w-7 p-0 flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex items-center justify-center"
        >
          <MinusCircle className="h-4 w-4" />
        </button>
      )}
      {totalBanners > 1 && (
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gray-200 dark:bg-gray-700">
          <motion.div
            className={cn(
              "h-full",
              message.type === "success" && "bg-green-500 dark:bg-green-400",
              message.type === "error" && "bg-red-500 dark:bg-red-400",
              message.type === "warning" && "bg-yellow-500 dark:bg-yellow-400",
              message.type === "info" && "bg-blue-500 dark:bg-blue-400"
            )}
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{
              duration: ROTATION_INTERVAL / 1000,
              ease: "linear",
            }}
          />
        </div>
      )}
    </motion.div>
  );
}
