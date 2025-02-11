"use client";

import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: any) => void;
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
      <DialogContent className="p-0">
        <DialogTitle className="sr-only">Pick an emoji</DialogTitle>
        <div className="border-0">
          <Picker
            data={data}
            onEmojiSelect={(emoji: any) => {
              onEmojiSelect(emoji);
              setOpen(false);
            }}
            theme="light"
            previewPosition="none"
            skinTonePosition="none"
            searchPosition="none"
            navPosition="none"
            perLine={8}
            maxFrequentRows={0}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
