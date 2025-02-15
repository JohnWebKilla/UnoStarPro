"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { MessageActions } from "../MessageActions";
import { MessageAvatar } from "../MessageAvatar";
import { EmojiPicker } from "../EmojiPicker";
import { ArrowLeft, Paperclip, Send, Reply, X } from "lucide-react";
import { Message, ChatGroup } from "../types";

interface ChatViewUIProps {
  selectedGroup: ChatGroup;
  onBack: () => void;
  onSendMessage: (message: Message) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  userRole: string;
  newMessage: string;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>;
  isEditing: string | null;
  setIsEditing: (id: string | null) => void;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  handleFileUpload: (files: FileList) => void;
}

export function ChatViewUI({
  selectedGroup,
  onBack,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  userRole,
  newMessage,
  setNewMessage,
  isEditing,
  setIsEditing,
  replyingTo,
  setReplyingTo,
  handleFileUpload,
}: ChatViewUIProps) {
  return (
    <div className="w-1/4 bg-white dark:bg-gray-900 rounded-md border border-gray-300 dark:border-gray-700 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
        <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{selectedGroup.name}</h2>
          {selectedGroup.isGroup && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedGroup.members.length} members
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {selectedGroup.messages.map((message, index) => {
          const prevMessage =
            index > 0 ? selectedGroup.messages[index - 1] : null;
          const nextMessage =
            index < selectedGroup.messages.length - 1
              ? selectedGroup.messages[index + 1]
              : null;
          const isFirstInGroup =
            !prevMessage || prevMessage.sender !== message.sender;
          const isLastInGroup =
            !nextMessage || nextMessage.sender !== message.sender;

          return (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.sender === "You" ? "items-end" : "items-start"
              } ${!isLastInGroup ? "mb-1" : "mb-4"}`}
            >
              {message.replyTo && (
                <div className="text-xs text-gray-500 mb-1">
                  Replying to:{" "}
                  {
                    selectedGroup.messages.find((m) => m.id === message.replyTo)
                      ?.content
                  }
                </div>
              )}
              <div className="flex items-end gap-2">
                {message.sender !== "You" && isLastInGroup && (
                  <MessageAvatar
                    name={message.sender}
                    isGroup={selectedGroup.isGroup}
                  />
                )}
                {message.sender !== "You" && !isLastInGroup && (
                  <div className="w-8" aria-hidden="true" />
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === "You"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800"
                  } ${!isLastInGroup ? "rounded-br-md" : ""} ${
                    !isFirstInGroup ? "rounded-tr-md" : ""
                  }`}
                >
                  {isFirstInGroup &&
                    !selectedGroup.isGroup &&
                    message.sender !== "You" && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {message.sender}
                      </p>
                    )}
                  {isEditing === message.id ? (
                    <div className="flex flex-col gap-2 w-full">
                      <Textarea
                        defaultValue={message.content}
                        className={`min-h-[60px] bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 ${
                          message.sender === "You"
                            ? "border-blue-300 focus:border-blue-400"
                            : "border-gray-300 focus:border-gray-400"
                        }`}
                        id={`edit-textarea-${message.id}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onEditMessage(message.id, e.currentTarget.value);
                            setIsEditing(null);
                          }
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => setIsEditing(null)}
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
                              onEditMessage(message.id, textarea.value);
                              setIsEditing(null);
                            }
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.files?.map((file, index) => (
                        <div key={index} className="mt-2">
                          {file.type === "image" ? (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="max-w-full rounded"
                            />
                          ) : (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm"
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
                {message.sender === "You" && isLastInGroup && (
                  <MessageAvatar name="You" />
                )}
                {message.sender === "You" && !isLastInGroup && (
                  <div className="w-8" />
                )}
                <MessageActions
                  isOwnMessage={message.sender === "You"}
                  onEdit={() => setIsEditing(message.id)}
                  onDelete={() => onDeleteMessage(message.id)}
                  onReply={() => setReplyingTo(message.id)}
                />
              </div>
              {isLastInGroup && (
                <div
                  className={`flex items-center gap-2 mt-1 ${
                    message.sender === "You" ? "justify-end" : "justify-start"
                  }`}
                >
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(message.timestamp, {
                      addSuffix: true,
                    })}
                  </span>
                  {message.edited && (
                    <span className="text-xs text-gray-500">(edited)</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
            <Reply className="h-4 w-4" />
            <span>
              Replying to:{" "}
              {selectedGroup.messages.find((m) => m.id === replyingTo)?.content}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 flex gap-2">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  handleFileUpload(e.target.files);
                }
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <EmojiPicker
              onEmojiSelect={(emoji: any) => {
                setNewMessage((prev) => prev + emoji.native);
              }}
            />
            <Textarea
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[2.5rem] max-h-[10rem]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (newMessage.trim()) {
                    onSendMessage({
                      id: `msg${Date.now()}`,
                      content: newMessage,
                      sender: "You",
                      timestamp: new Date(),
                      read: true,
                      replyTo: replyingTo || undefined,
                    });
                    setNewMessage("");
                    setReplyingTo(null);
                  }
                }
              }}
            />
          </div>
          <Button
            onClick={() => {
              if (newMessage.trim()) {
                onSendMessage({
                  id: `msg${Date.now()}`,
                  content: newMessage,
                  sender: "You",
                  timestamp: new Date(),
                  read: true,
                  replyTo: replyingTo || undefined,
                });
                setNewMessage("");
                setReplyingTo(null);
              }
            }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
