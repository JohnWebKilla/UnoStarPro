"use client";

import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

// Common emojis that are frequently used in chat/messaging
const COMMON_EMOJIS = [
  "👍",
  "👎",
  "😊",
  "😂",
  "🤔",
  "👋",
  "🎉",
  "❤️",
  "👀",
  "🙌",
  "🤝",
  "👏",
  "🔥",
  "⭐",
  "✅",
  "❌",
  "💡",
  "💪",
  "🎯",
  "🚀",
  "💯",
  "🙏",
  "👌",
  "✨",
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Smile className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="p-4">
        <DialogTitle className="mb-4">Pick an emoji</DialogTitle>
        <div className="grid grid-cols-8 gap-2">
          {COMMON_EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-muted"
              onClick={() => {
                onEmojiSelect(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
