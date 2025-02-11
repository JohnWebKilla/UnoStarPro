"use client";

import * as React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Message, ChatGroup } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { MessageActions } from "./MessageActions";
import { MessageAvatar } from "./MessageAvatar";
import { EmojiPicker } from "./EmojiPicker";
import {
  ArrowLeft,
  Paperclip,
  Send,
  Reply,
  X,
  MoreVertical,
  LogOut,
  Trash2,
} from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupManagement } from "./GroupManagement";

interface ChatViewProps {
  selectedGroup: ChatGroup;
  onBack: () => void;
  onSendMessage: (message: Message) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onUpdateGroup: (groupId: string, updates: any) => void;
  onAddMember: (groupId: string, memberId: string) => void;
  onRemoveMember: (groupId: string, memberId: string) => void;
  userRole: string;
  currentUser: {
    id: string;
    name: string;
    image?: string;
  };
  onDeleteChat: (groupId: string) => void;
  onLeaveGroup: (groupId: string) => void;
}

const ChatView: React.FC<ChatViewProps> = (props) => {
  const [newMessage, setNewMessage] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    selectedGroup,
    onBack,
    onSendMessage,
    onEditMessage,
    onDeleteMessage,
    onUpdateGroup,
    onAddMember,
    onRemoveMember,
    userRole,
    currentUser,
    onDeleteChat,
    onLeaveGroup,
  } = props;

  // Add local state for messages
  const [localMessages, setLocalMessages] = useState<Message[]>(
    selectedGroup.messages
  );

  // Update local messages when selectedGroup changes
  useEffect(() => {
    setLocalMessages(selectedGroup.messages);
  }, [selectedGroup.messages]);

  // Update messagesByDate to use localMessages
  const messagesByDate = useMemo(() => {
    const groups: { [key: string]: Message[] } = {};
    localMessages.forEach((message) => {
      const date = new Date(message.timestamp).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
  }, [localMessages]);

  // Create wrapped handlers for edit and delete
  const handleEditMessage = (messageId: string, newContent: string) => {
    // Update local state immediately
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, content: newContent, edited: true }
          : msg
      )
    );
    // Call parent handler
    onEditMessage(messageId, newContent);
  };

  const handleDeleteMessage = (messageId: string) => {
    // Update local state immediately
    setLocalMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    // Call parent handler
    onDeleteMessage(messageId);
  };

  const handleSendMessage = (message: Message) => {
    // Update local state immediately
    setLocalMessages((prev) => [...prev, message]);
    // Call parent handler
    onSendMessage(message);
  };

  const handleTyping = () => {
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedGroup.messages]);

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const newMsg: Message = {
        id: `msg${Date.now()}`,
        content: "",
        sender: "You",
        timestamp: new Date(),
        read: true,
        files: [
          {
            name: file.name,
            url: URL.createObjectURL(file),
            type: isImage ? "image" : "document",
          },
        ],
      };
      onSendMessage(newMsg);
    });
  };

  const handlePromoteToAdmin = (groupId: string, memberId: string) => {
    const updatedMembers = selectedGroup.members.map((member) =>
      member.id === memberId ? { ...member, role: "admin" } : member
    );
    onUpdateGroup(groupId, { members: updatedMembers });
  };

  const handleDemoteFromAdmin = (groupId: string, memberId: string) => {
    const updatedMembers = selectedGroup.members.map((member) =>
      member.id === memberId ? { ...member, role: "member" } : member
    );
    onUpdateGroup(groupId, { members: updatedMembers });
  };

  // Add reaction handlers
  const handleAddReaction = (messageId: string, emoji: string) => {
    setLocalMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions || [];
        const existingReaction = reactions.find((r) => r.emoji === emoji);

        // Check if we're at the limit and this is a new emoji
        if (reactions.length >= 3 && !existingReaction) {
          return msg;
        }

        if (existingReaction) {
          // Add user to existing reaction
          return {
            ...msg,
            reactions: reactions.map((r) =>
              r.emoji === emoji
                ? {
                    ...r,
                    users: [
                      ...r.users,
                      { id: currentUser.id, name: currentUser.name },
                    ],
                  }
                : r
            ),
          };
        } else {
          // Create new reaction
          return {
            ...msg,
            reactions: [
              ...reactions,
              {
                emoji,
                users: [{ id: currentUser.id, name: currentUser.name }],
              },
            ],
          };
        }
      })
    );
  };

  const handleRemoveReaction = (messageId: string, emoji: string) => {
    setLocalMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions || [];
        return {
          ...msg,
          reactions: reactions
            .map((r) => {
              if (r.emoji !== emoji) return r;
              return {
                ...r,
                users: r.users.filter(
                  (u: { id: string; name: string }) => u.id !== currentUser.id
                ),
              };
            })
            .filter((r) => r.users.length > 0), // Remove reactions with no users
        };
      })
    );
  };

  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-md border border-gray-300 dark:border-gray-700 flex flex-col">
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
        {selectedGroup.isGroup && (
          <GroupManagement
            group={selectedGroup}
            currentUser={currentUser}
            onUpdateGroup={onUpdateGroup}
            onAddMember={onAddMember}
            onRemoveMember={onRemoveMember}
            onPromoteToAdmin={handlePromoteToAdmin}
            onDemoteFromAdmin={handleDemoteFromAdmin}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {selectedGroup.isGroup ? (
              <>
                {userRole === "admin" && (
                  <>
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to delete this group?"
                          )
                        ) {
                          onDeleteChat(selectedGroup.id);
                          onBack();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Group
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to leave this group?"
                      )
                    ) {
                      onLeaveGroup(selectedGroup.id);
                      onBack();
                    }
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Group
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                className="text-red-600 dark:text-red-400"
                onClick={() => {
                  if (
                    window.confirm("Are you sure you want to delete this chat?")
                  ) {
                    onDeleteChat(selectedGroup.id);
                    onBack();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Chat
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {Object.entries(messagesByDate).map(([date, messages]) => (
          <div key={date} className="space-y-4">
            <div className="flex justify-center">
              <div className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full text-xs">
                {date === new Date().toLocaleDateString()
                  ? "Today"
                  : date ===
                      new Date(Date.now() - 86400000).toLocaleDateString()
                    ? "Yesterday"
                    : date}
              </div>
            </div>
            {messages.map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const nextMessage =
                index < messages.length - 1 ? messages[index + 1] : null;
              const isFirstInGroup =
                !prevMessage || prevMessage.sender !== message.sender;
              const isLastInGroup =
                !nextMessage || nextMessage.sender !== message.sender;

              const sender = selectedGroup.members.find(
                (member) => member.id === message.sender
              );

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  showSender={
                    isFirstInGroup &&
                    !selectedGroup.isGroup &&
                    message.sender !== currentUser.id
                  }
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onReply={(id) => setReplyingTo(id)}
                  isEditing={isEditing === message.id}
                  setIsEditing={(value) =>
                    setIsEditing(value ? message.id : null)
                  }
                  currentUser={currentUser}
                  sender={sender}
                  onAddReaction={handleAddReaction}
                  onRemoveReaction={handleRemoveReaction}
                />
              );
            })}
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-bounce">•</div>
            <div className="animate-bounce delay-100">•</div>
            <div className="animate-bounce delay-200">•</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <MessageInput
        onSend={(content, files) => {
          if (content.trim() || files?.length) {
            const newMsg: Message = {
              id: `msg${Date.now()}`,
              content,
              sender: currentUser.id,
              timestamp: new Date(),
              read: true,
              replyTo: replyingTo || undefined,
              files: files?.map((file) => ({
                name: file.name,
                url: URL.createObjectURL(file),
                type: file.type.startsWith("image/") ? "image" : "document",
              })),
            };
            handleSendMessage(newMsg);
            setReplyingTo(null);
          }
        }}
        onTyping={handleTyping}
        disabled={false}
        currentUser={currentUser}
        replyingTo={
          replyingTo
            ? {
                id: replyingTo,
                content:
                  localMessages.find((m) => m.id === replyingTo)?.content || "",
              }
            : null
        }
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
};

export default ChatView;
