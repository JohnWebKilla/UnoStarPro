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

export const Banner = ({
  message,
  onDismiss,
  totalBanners,
  currentIndex,
}: BannerProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [selectedLanguage, setSelectedLanguage] =
    useState<keyof typeof LANGUAGES>("en");

  // Reset and start progress when message changes
  useEffect(() => {
    setProgress(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / ROTATION_INTERVAL) * 100;
      if (newProgress <= 100) {
        setProgress(newProgress);
      }
    }, 10);

    return () => clearInterval(interval);
  }, [message.id]);

  // Prepare translations including the default English content
  const translations = [
    { title: message.title, content: message.content, language: "en" },
    ...(message.translations || []),
  ];

  const currentContent =
    translations.find((t) => t.language === selectedLanguage) ||
    translations[0];
  const availableLanguages = Array.from(
    new Set(translations.map((t) => t.language))
  );

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

  const getProgressColor = () => {
    switch (message.type) {
      case "success":
        return "bg-green-500 dark:bg-green-400";
      case "error":
        return "bg-red-500 dark:bg-red-400";
      case "warning":
        return "bg-yellow-500 dark:bg-yellow-400";
      default:
        return "bg-blue-500 dark:bg-blue-400";
    }
  };

  const getIcon = () => {
    const className = "h-5 w-5";
    switch (message.type) {
      case "success":
        return <CheckCircle2 className={className} />;
      case "error":
        return <AlertCircle className={className} />;
      case "warning":
        return <AlertTriangle className={className} />;
      default:
        return <Info className={className} />;
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  return (
    <AnimatePresence initial={false} mode="wait" custom={currentIndex}>
      {isVisible && (
        <motion.div
          key={message.id}
          custom={currentIndex}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="relative w-full"
        >
          <div
            className={cn(
              getBannerColor(),
              "border-b px-4 h-14 flex items-center justify-between shadow-sm relative overflow-hidden"
            )}
          >
            {/* Progress bar */}
            {totalBanners > 1 && (
              <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gray-200 dark:bg-gray-700">
                <motion.div
                  className={cn("h-full", getProgressColor())}
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>
            )}

            <div className="flex items-center space-x-3 flex-grow min-w-0">
              <div className="flex-shrink-0">{getIcon()}</div>
              <motion.div
                key={selectedLanguage}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-medium truncate">{currentContent.title}</p>
                  <span className="text-current opacity-40 flex-shrink-0">
                    •
                  </span>
                  <p className="text-sm truncate">{currentContent.content}</p>
                </div>
                {availableLanguages.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0"
                      >
                        <Globe className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {availableLanguages.map((lang) => (
                        <DropdownMenuItem
                          key={lang}
                          onClick={() =>
                            setSelectedLanguage(lang as keyof typeof LANGUAGES)
                          }
                          className={cn(
                            "text-sm",
                            selectedLanguage === lang && "font-medium bg-accent"
                          )}
                        >
                          {LANGUAGES[lang as keyof typeof LANGUAGES]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </motion.div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {totalBanners > 1 && (
                <div className="flex gap-1">
                  {Array.from({ length: totalBanners }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                        index === currentIndex ? "bg-current" : "bg-current/20"
                      )}
                    />
                  ))}
                </div>
              )}
              {message.dismissible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-7 w-7 p-0 flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <MinusCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
