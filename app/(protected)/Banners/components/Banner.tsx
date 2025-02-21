import React, { useState } from "react";
import { NotificationMessage } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
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
}

const LANGUAGES = {
  en: "English",
  uz: "O'zbek",
  ru: "Русский",
} as const;

export const Banner = ({ message, onDismiss }: BannerProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [selectedLanguage, setSelectedLanguage] =
    useState<keyof typeof LANGUAGES>("en");

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
              "border-b px-4 py-2.5 flex items-center justify-between shadow-sm"
            )}
          >
            <div className="flex items-center space-x-3 flex-grow">
              <div className="flex-shrink-0">
                {message.image ? (
                  <Image
                    src={message.image}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded"
                  />
                ) : (
                  getIcon()
                )}
              </div>
              <motion.div
                key={selectedLanguage}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3"
              >
                <div className="flex flex-col">
                  <p className="font-medium">{currentContent.title}</p>
                  <p className="text-sm">{currentContent.content}</p>
                </div>
                {availableLanguages.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
            {message.dismissible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-7 w-7 p-0 flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700"
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
