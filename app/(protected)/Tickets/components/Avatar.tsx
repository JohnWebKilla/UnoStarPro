"use client";

import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface AvatarProps {
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

export function Avatar({ name, image, size = "md", online }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  return (
    <div className="relative">
      {image ? (
        <img
          src={image}
          alt={name}
          className={cn("rounded-full object-cover", sizeClasses[size])}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-medium",
            "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
            sizeClasses[size]
          )}
        >
          {initials}
        </div>
      )}
      {typeof online === "boolean" && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-gray-900",
            "h-2.5 w-2.5",
            online ? "bg-green-500" : "bg-gray-400"
          )}
        />
      )}
    </div>
  );
}
