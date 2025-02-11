"use client";

import { useState, useCallback } from "react";
import {
  Search,
  Users,
  Plus,
  MessageSquare,
  ChevronDown,
  Send,
  ArrowLeft,
  Reply,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { GroupSettings } from "./GroupSettings";
import { MessageActions } from "./MessageActions";
import { Paperclip, Image, File, Smile } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { EmojiPicker } from "./EmojiPicker";
import { MessageAvatar } from "./MessageAvatar";
import ChatView from "./ChatView";
import { ChatGroup, Message } from "./types";
import { CreateChat } from "./CreateChat";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

interface ChatProps {
  userRole?: "admin" | "driver" | "user";
  currentUser: {
    id: string;
    name: string;
    image?: string;
  };
}

export function Chat({ userRole = "admin", currentUser }: ChatProps) {
  const [activeTab, setActiveTab] = useState<"office" | "drivers">("office");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [groups, setGroups] = useState<ChatGroup[]>([
    {
      id: "1",
      name: "Office General",
      type: "office",
      isGroup: true,
      members: [
        {
          id: currentUser.id,
          name: currentUser.name,
          role: "admin",
          type: "user",
        },
        {
          id: "Jane",
          name: "Jane",
          role: "admin",
          type: "user",
        },
        {
          id: "Bob",
          name: "Bob",
          role: "member",
          type: "user",
        },
      ],
      unreadCount: 3,
      lastMessage: {
        id: "msg1",
        content: "When is the next meeting?",
        sender: "Jane",
        timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
        read: false,
      },
      messages: [
        {
          id: "msg1",
          content: "When is the next meeting?",
          sender: "Jane",
          timestamp: new Date(Date.now() - 1000 * 60 * 15),
          read: false,
        },
        {
          id: "msg2",
          content: "Tomorrow at 10 AM",
          sender: "Bob",
          timestamp: new Date(Date.now() - 1000 * 60 * 14),
          read: true,
        },
      ],
    },
    {
      id: "2",
      name: "Drivers Group",
      type: "drivers",
      isGroup: true,
      members: ["Driver1", "Driver2", "Driver3"],
      unreadCount: 0,
      lastMessage: {
        id: "msg3",
        content: "Route updated for tomorrow",
        sender: "Driver1",
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        read: true,
      },
      messages: [],
      members: [
        {
          id: "Driver1",
          name: "Driver1",
          role: "admin",
          type: "driver",
        },
        {
          id: "Driver2",
          name: "Driver2",
          role: "member",
          type: "driver",
        },
        {
          id: "Driver3",
          name: "Driver3",
          role: "member",
          type: "driver",
        },
      ],
    },
    {
      id: "3",
      name: "John Doe",
      type: "office",
      isGroup: false,
      unreadCount: 1,
      lastMessage: {
        id: "msg4",
        content: "Can you review this?",
        sender: "John Doe",
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        read: false,
      },
      messages: [],
      members: [
        {
          id: "John Doe",
          name: "John Doe",
          role: "admin",
          type: "user",
        },
      ],
    },
  ]);

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const onlineUsers = useOnlineStatus();

  const handleSendMessage = (customMessage?: Message) => {
    if (!selectedGroup) return;

    if (customMessage) {
      const updatedGroups = groups.map((group) => {
        if (group.id === selectedGroup.id) {
          return {
            ...group,
            messages: [
              ...group.messages,
              {
                ...customMessage,
                sender: currentUser.id,
              },
            ],
            lastMessage: {
              ...customMessage,
              sender: currentUser.id,
            },
          };
        }
        return group;
      });

      setGroups(updatedGroups);
      setSelectedGroup((prev) =>
        prev ? updatedGroups.find((g) => g.id === prev.id) || null : null
      );
      return;
    }

    if (!newMessage.trim()) return;

    const newMsg: Message = {
      id: `msg${Date.now()}`,
      content: newMessage,
      sender: currentUser.id,
      timestamp: new Date(),
      read: true,
    };

    const updatedGroups = groups.map((group) => {
      if (group.id === selectedGroup.id) {
        return {
          ...group,
          messages: [...group.messages, newMsg],
          lastMessage: newMsg,
        };
      }
      return group;
    });

    setGroups(updatedGroups);
    setNewMessage("");
    setSelectedGroup((prev) =>
      prev ? updatedGroups.find((g) => g.id === prev.id) || null : null
    );
  };

  const handleUpdateGroup = (groupId: string, updates: any) => {
    setGroups(
      groups.map((group) =>
        group.id === groupId ? { ...group, ...updates } : group
      )
    );
  };

  const handleAddMember = (groupId: string, memberId: string) => {
    // Implement member addition logic
  };

  const handleRemoveMember = (groupId: string, memberId: string) => {
    // Implement member removal logic
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    const updatedGroups = groups.map((group) => {
      if (group.id === selectedGroup?.id) {
        return {
          ...group,
          messages: group.messages.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: newContent, edited: true }
              : msg
          ),
        };
      }
      return group;
    });
    setGroups(updatedGroups);
    setIsEditing(null);
  };

  const handleDeleteMessage = (messageId: string) => {
    const updatedGroups = groups.map((group) => {
      if (group.id === selectedGroup?.id) {
        return {
          ...group,
          messages: group.messages.filter((msg) => msg.id !== messageId),
        };
      }
      return group;
    });
    setGroups(updatedGroups);
  };

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const newMsg: Message = {
        id: `msg${Date.now()}`,
        content: "",
        sender: currentUser.id,
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
      handleSendMessage(newMsg);
    });
  };

  const handleDeleteChat = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((group) => group.id !== groupId));
  }, []);

  const handleLeaveGroup = useCallback(
    (groupId: string) => {
      setGroups((prev) =>
        prev.map((group) => {
          if (group.id === groupId) {
            return {
              ...group,
              members: group.members.filter(
                (member) => member.id !== currentUser.id
              ),
            };
          }
          return group;
        })
      );
      setSelectedGroup(null);
    },
    [currentUser.id]
  );

  const handleCreateGroup = (groupData: {
    name: string;
    members: { id: string; name: string; role: string; type: string }[];
  }) => {
    const newGroup: ChatGroup = {
      id: `group${Date.now()}`,
      name: groupData.name,
      type: "office", // or determine based on members
      isGroup: true,
      members: groupData.members,
      messages: [],
      unreadCount: 0,
    };
    setGroups((prev) => [...prev, newGroup]);
  };

  const handleCreateDirectMessage = (userId: string) => {
    // Find user from your user list
    const user = availableUsers.find((u) => u.id === userId);
    if (!user) return;

    // Check if chat already exists
    const existingChat = groups.find(
      (g) => !g.isGroup && g.members.some((m) => m.id === userId)
    );

    if (existingChat) {
      setSelectedGroup(existingChat);
      return;
    }

    const newChat: ChatGroup = {
      id: `chat${Date.now()}`,
      name: user.name,
      type: user.type === "driver" ? "drivers" : "office",
      isGroup: false,
      members: [
        { ...currentUser, role: "member", type: "user" },
        { ...user, role: "member" },
      ],
      messages: [],
      unreadCount: 0,
    };
    setGroups((prev) => [...prev, newChat]);
  };

  if (selectedGroup) {
    return (
      <ChatView
        selectedGroup={selectedGroup}
        onBack={() => setSelectedGroup(null)}
        onSendMessage={handleSendMessage}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onUpdateGroup={handleUpdateGroup}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onDeleteChat={handleDeleteChat}
        onLeaveGroup={handleLeaveGroup}
        userRole={userRole}
        currentUser={currentUser}
      />
    );
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-md border border-gray-300 dark:border-gray-700 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Messages</h2>
          <CreateChat
            onCreateGroup={handleCreateGroup}
            onCreateDirectMessage={handleCreateDirectMessage}
            currentUser={currentUser}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === "office"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
          onClick={() => setActiveTab("office")}
        >
          Office
        </button>
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === "drivers"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
          onClick={() => setActiveTab("drivers")}
        >
          Drivers
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-auto">
        {groups
          .filter((group) => group.type === activeTab)
          .map((group) => (
            <div
              key={group.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-200 dark:border-gray-700"
              onClick={() => setSelectedGroup(group)}
            >
              <div className="flex-shrink-0 relative">
                {group.isGroup ? (
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  </div>
                ) : (
                  <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {group.name.charAt(0)}
                    </span>
                  </div>
                )}
                {!group.isGroup && (
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900",
                      onlineUsers[group.members[0]?.id]
                        ? "bg-green-500"
                        : "bg-gray-400"
                    )}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-sm font-medium truncate">{group.name}</h3>
                  {group.lastMessage && (
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(group.lastMessage.timestamp, {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  {group.lastMessage && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {group.lastMessage.sender}: {group.lastMessage.content}
                    </p>
                  )}
                  {group.unreadCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full ml-2">
                      {group.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
