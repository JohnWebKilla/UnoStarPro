"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface EmojiListProps {
  onSelect: (emoji: string) => void;
}

const COMMON_EMOJIS = ["😂", "😢", "🤔", "👀", "🔥", "👍"];

export function EmojiList({ onSelect }: EmojiListProps) {
  return (
    <div className="flex items-center bg-[#222222] rounded-full py-1.5 px-2 gap-1 shadow-lg">
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="hover:bg-[#333333] p-1.5 rounded-full transition-colors text-xl"
        >
          {emoji}
        </button>
      ))}
      <div className="h-4 w-[1px] bg-gray-700 mx-0.5" /> {/* Divider */}
      <button className="hover:bg-[#333333] p-1.5 rounded-full transition-colors">
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
    </div>
  );
}
