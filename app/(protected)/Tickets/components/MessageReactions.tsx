"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import { EmojiList } from "./EmojiList";
import { cn } from "@/lib/utils";

interface Reaction {
  emoji: string;
  users: { id: string; name: string }[];
}

interface MessageReactionsProps {
  reactions: Reaction[];
  onAddReaction: (emoji: string) => void;
  onRemoveReaction: (emoji: string) => void;
  currentUser: {
    id: string;
    name: string;
  };
  isOwn?: boolean;
}

const MAX_REACTIONS = 3;

export function MessageReactions({
  reactions,
  onAddReaction,
  onRemoveReaction,
  currentUser,
  isOwn = false,
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReactionClick = (emoji: string) => {
    const reaction = reactions.find((r) => r.emoji === emoji);
    const hasReacted = reaction?.users.some((u) => u.id === currentUser.id);

    if (hasReacted) {
      onRemoveReaction(emoji);
    } else {
      // Only allow new emoji if under limit or reacting to an existing emoji
      if (
        reactions.length < MAX_REACTIONS ||
        reactions.some((r) => r.emoji === emoji)
      ) {
        onAddReaction(emoji);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(true)}
        className={cn(
          "h-6 w-6 flex items-center justify-center rounded-full",
          isOwn
            ? "bg-white/10 hover:bg-white/20 text-white/70"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        )}
      >
        <Smile className="h-3.5 w-3.5" />
      </button>

      {showPicker && (
        <div
          className={cn("absolute -top-10", isOwn ? "-left-20" : "-right-20")}
        >
          <EmojiList
            onSelect={(emoji) => {
              handleReactionClick(emoji);
              setShowPicker(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
