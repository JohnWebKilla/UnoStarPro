"use client";

import { Message } from "./types";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, Check, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MessageActions } from "./MessageActions";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { MessageReactions } from "./MessageReactions";
import { useState } from "react";

interface MessageBubbleProps {
  message: Message;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showSender: boolean;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onReply: (messageId: string) => void;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  currentUser: {
    id: string;
    name: string;
    image?: string;
  };
  sender?: {
    id: string;
    name: string;
    image?: string;
    online?: boolean;
  };
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
}

export function MessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
  showSender,
  onEdit,
  onDelete,
  onReply,
  isEditing,
  setIsEditing,
  currentUser,
  sender,
  onAddReaction,
  onRemoveReaction,
}: MessageBubbleProps) {
  const isOwn = message.sender === currentUser.id;
  const senderInfo = isOwn ? currentUser : sender;
  const onlineUsers = useOnlineStatus();
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div
      className={cn(
        "group flex flex-col",
        isOwn ? "items-end" : "items-start",
        !isLastInGroup && "mb-1"
      )}
    >
      {isFirstInGroup && !isOwn && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-12 mb-1">
          {senderInfo?.name || "Unknown"}
        </span>
      )}

      {message.replyTo && (
        <div className="text-xs text-gray-500 mb-1 mx-12">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-gray-400" />
            <span>Replying to message</span>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-[80%] relative group">
        {!isOwn && isLastInGroup && (
          <div className="flex-shrink-0">
            <Avatar
              name={senderInfo?.name || "Unknown"}
              image={senderInfo?.image}
              size="sm"
          <Avatar
            name={senderInfo?.name || "Unknown"}
            image={senderInfo?.image}
            size="sm"
            online={senderInfo ? onlineUsers[senderInfo.id] : undefined}
          />
        )}
        {!isOwn && !isLastInGroup && <div className="w-8" />}

        {isOwn && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageActions
              isOwnMessage={isOwn}
              onEdit={() => setIsEditing(true)}
              onDelete={() => onDelete(message.id)}
              onReply={() => onReply(message.id)}
            />
          </div>
        )}

        {isOwn && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div onClick={() => setShowReactions(!showReactions)}>
              <MessageReactions
                reactions={message.reactions || []}
                onAddReaction={(emoji) => {
                  onAddReaction(message.id, emoji);
                  setShowReactions(false);
                }}
                onRemoveReaction={(emoji) =>
                  onRemoveReaction(message.id, emoji)
                }
                currentUser={currentUser}
                isOwn={isOwn}
              />
            </div>
          </div>
        )}

        <div className="relative">
          <div
            className={cn(
              "px-3 py-2",
              "rounded-lg",
              isOwn
                ? "bg-[#3390ec] text-white border border-blue-400/20"
                : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50",
              isOwn
                ? isFirstInGroup
                  ? isLastInGroup
                    ? "rounded-lg"
                    : "rounded-t-lg rounded-bl-lg rounded-br-sm"
                  : isLastInGroup
                    ? "rounded-b-lg rounded-tr-sm rounded-tl-lg"
                    : "rounded-l-lg rounded-tr-sm rounded-br-sm"
                : isFirstInGroup
                  ? isLastInGroup
                    ? "rounded-lg"
                    : "rounded-t-lg rounded-br-lg rounded-bl-sm"
                  : isLastInGroup
                    ? "rounded-b-lg rounded-tl-sm rounded-tr-lg"
                    : "rounded-r-lg rounded-tl-sm rounded-bl-sm",
              "shadow-sm"
            )}
          >
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  defaultValue={message.content}
                  className="min-h-[60px] bg-transparent border-gray-400"
                  id={`edit-textarea-${message.id}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onEdit(message.id, e.currentTarget.value);
                      setIsEditing(false);
                    }
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const textarea = document.getElementById(
                        `edit-textarea-${message.id}`
                      ) as HTMLTextAreaElement;
                      if (textarea) {
                        onEdit(message.id, textarea.value);
                        setIsEditing(false);
                      }
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col">
                  <p className="text-[15px] whitespace-pre-wrap break-words leading-[22px]">
                    {message.content}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {message.reactions.map((reaction) => {
                          const hasReacted = reaction.users.some(
                            (u: { id: string; name: string }) =>
                              u.id === currentUser.id
                          );
                          return (
                            <button
                              key={reaction.emoji}
                              onClick={() => {
                                if (
                                  reaction.users.some(
                                    (u: { id: string; name: string }) =>
                                      u.id === currentUser.id
                                  )
                                ) {
                                  onRemoveReaction(message.id, reaction.emoji);
                                } else {
                                  onAddReaction(message.id, reaction.emoji);
                                }
                              }}
                              className={cn(
                                "flex items-center h-5 px-1.5 rounded-full text-sm",
                                isOwn
                                  ? "bg-white/10 hover:bg-white/20 text-white"
                                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
                                hasReacted && "ring-1 ring-white/20"
                              )}
                            >
                              <span>{reaction.emoji}</span>
                              {reaction.users.length > 1 && (
                                <span
                                  className={cn(
                                    "ml-0.5 text-xs",
                                    isOwn ? "text-white/70" : "text-gray-500"
                                  )}
                                >
                                  {reaction.users.length}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <span
                      className={cn(
                        "text-[11px]",
                        isOwn ? "text-white/70" : "text-gray-400"
                      )}
                    >
                      {formatDistanceToNow(message.timestamp, {
                        addSuffix: true,
                      })}
                    </span>
                    {message.edited && (
                      <span
                        className={cn(
                          "text-[11px]",
                          isOwn ? "text-white/70" : "text-gray-400"
                        )}
                      >
                        (edited)
                      </span>
                    )}
                    {message.read ? (
                      <Check
                        className={cn(
                          "h-3 w-3",
                          isOwn ? "text-white/70" : "text-gray-400"
                        )}
                      />
                    ) : (
                      <Clock
                        className={cn(
                          "h-3 w-3",
                          isOwn ? "text-white/70" : "text-gray-400"
                        )}
                      />
                    )}
                  </div>
                </div>
                {message.files?.map((file, index) => (
                  <div key={index} className="mt-2">
                    {file.type === "image" ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(file.url, "_blank")}
                      />
                    ) : (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm hover:underline"
                      >
                        <Paperclip className="h-4 w-4" />
                        {file.name}
                      </a>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {!isOwn && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div onClick={() => setShowReactions(!showReactions)}>
              <MessageReactions
                reactions={message.reactions || []}
                onAddReaction={(emoji) => {
                  onAddReaction(message.id, emoji);
                  setShowReactions(false);
                }}
                onRemoveReaction={(emoji) =>
                  onRemoveReaction(message.id, emoji)
                }
                currentUser={currentUser}
                isOwn={isOwn}
              />
            </div>
          </div>
        )}

        {!isOwn && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageActions
              isOwnMessage={isOwn}
              onEdit={() => setIsEditing(true)}
              onDelete={() => onDelete(message.id)}
              onReply={() => onReply(message.id)}
            />
          </div>
        )}

        {isOwn && isLastInGroup && (
          <Avatar name={currentUser.name} image={currentUser.image} size="sm" />
        )}
        {isOwn && !isLastInGroup && <div className="w-8" />}
      </div>
    </div>
  );
}
