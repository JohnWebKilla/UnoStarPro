"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { EmojiPickerPortal } from "./EmojiPickerPortal";
import {
  Paperclip,
  Send,
  X,
  Image as ImageIcon,
  File,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiList } from "./EmojiList";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MessageInputProps {
  onSend: (content: string, files?: File[]) => void;
  onTyping: () => void;
  placeholder?: string;
  disabled?: boolean;
  replyingTo?: { id: string; content: string } | null;
  onCancelReply?: () => void;
  currentUser: {
    id: string;
    name: string;
    image?: string;
  };
}

export function MessageInput({
  onSend,
  onTyping,
  placeholder = "Type a message...",
  disabled = false,
  replyingTo,
  onCancelReply,
  currentUser,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const handleTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping();
    typingTimeoutRef.current = setTimeout(() => {
      // Typing stopped
    }, 1000);
  }, [onTyping]);

  const handleSend = useCallback(() => {
    if ((content.trim() || selectedFiles.length > 0) && !isUploading) {
      const newMsg: Message = {
        id: `msg${Date.now()}`,
        content,
        sender: currentUser.id,
        timestamp: new Date(),
        read: true,
        replyTo: replyingTo || undefined,
        files: selectedFiles.map((file) => ({
          name: file.name,
          url: URL.createObjectURL(file),
          type: file.type.startsWith("image/") ? "image" : "document",
        })),
      };
      onSend(content, selectedFiles);
      setContent("");
      setSelectedFiles([]);
      setShowEmojis(false);
      if (onCancelReply) onCancelReply();
    }
  }, [
    content,
    selectedFiles,
    isUploading,
    onSend,
    onCancelReply,
    replyingTo,
    currentUser.id,
  ]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setIsUploading(true);
        const files = Array.from(e.target.files);
        const validFiles = files.filter((file) => {
          const size = file.size / 1024 / 1024; // Convert to MB
          return size <= 10; // Max 10MB per file
        });

        if (validFiles.length !== files.length) {
          // Show error message for files that are too large
          alert(
            "Some files were too large and were not added. Maximum size is 10MB per file."
          );
        }

        setSelectedFiles((prev) => [...prev, ...validFiles]);
        setIsUploading(false);

        // Clear input value to allow selecting the same file again
        e.target.value = "";
      }
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, []);

  // Close emoji list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojis(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex-1 truncate">
            <span className="text-xs text-gray-500">Replying to:</span>
            <p className="text-sm truncate">{replyingTo.content}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 max-h-[200px] overflow-y-auto">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-2"
            >
              {file.type.startsWith("image/") ? (
                <div className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
              ) : (
                <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <File className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate max-w-[150px]">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="relative">
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled || isUploading}
              className={cn(
                "min-h-[40px] py-3 px-4 max-h-[10rem] resize-none pr-24",
                selectedFiles.length > 0 && "rounded-t-none"
              )}
              id="message-input"
            />
            <div className="absolute right-1 bottom-1.5 flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Popover open={showEmojis} onOpenChange={setShowEmojis}>
                <PopoverTrigger asChild>
                  <Button
                    ref={emojiButtonRef}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  side="top"
                  align="end"
                  sideOffset={10}
                >
                  <EmojiList
                    onSelect={(emoji: string) => {
                      const textarea = document.getElementById(
                        "message-input"
                      ) as HTMLTextAreaElement;
                      if (!textarea) return;

                      const cursorPos = textarea.selectionStart || 0;
                      const newContent =
                        content.substring(0, cursorPos) +
                        emoji +
                        content.substring(cursorPos);

                      setContent(newContent);

                      // Focus and set cursor position
                      textarea.focus();
                      const newCursorPos = cursorPos + emoji.length;
                      textarea.setSelectionRange(newCursorPos, newCursorPos);

                      // Close emoji picker
                      setShowEmojis(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSend}
          disabled={
            (!content.trim() && selectedFiles.length === 0) ||
            isUploading ||
            disabled
          }
          size="icon"
          className="h-10 w-10 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
