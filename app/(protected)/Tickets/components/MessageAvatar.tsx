"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MessageAvatarProps {
  name: string;
  isGroup?: boolean;
}

export function MessageAvatar({ name, isGroup }: MessageAvatarProps) {
  if (isGroup) {
    return (
      <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
        <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <Avatar className="h-8 w-8">
      <AvatarFallback className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm">
        {name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
