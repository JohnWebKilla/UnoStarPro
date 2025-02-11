"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, MessageSquare, Plus, Search } from "lucide-react";
import { ChatGroup } from "./types";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

interface CreateChatProps {
  onCreateGroup: (groupData: {
    name: string;
    members: { id: string; name: string; role: string; type: string }[];
  }) => void;
  onCreateDirectMessage: (userId: string) => void;
  currentUser: {
    id: string;
    name: string;
    image?: string;
  };
}

export function CreateChat({
  onCreateGroup,
  onCreateDirectMessage,
  currentUser,
}: CreateChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"group" | "direct" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<{
    [key: string]: { id: string; name: string; role: string; type: string };
  }>({});

  // Mock user list - replace with your actual user data
  const availableUsers = [
    { id: "user1", name: "John Doe", type: "user" },
    { id: "user2", name: "Jane Smith", type: "user" },
    { id: "driver1", name: "Driver 1", type: "driver" },
    { id: "driver2", name: "Driver 2", type: "driver" },
  ];

  const onlineUsers = useOnlineStatus();

  const filteredUsers = availableUsers.filter(
    (user) =>
      user.id !== currentUser.id &&
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateGroup = () => {
    if (groupName.trim() && Object.keys(selectedMembers).length > 0) {
      onCreateGroup({
        name: groupName,
        members: [
          { ...currentUser, role: "admin", type: "user" },
          ...Object.values(selectedMembers),
        ],
      });
      handleClose();
    }
  };

  const handleCreateDirectMessage = (user: (typeof availableUsers)[0]) => {
    onCreateDirectMessage(user.id);
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setMode(null);
    setGroupName("");
    setSearchQuery("");
    setSelectedMembers({});
  };

  const UserItem = ({ user, selected = false, onClick }: any) => (
    <div
      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">{user.name.charAt(0)}</span>
          </div>
          <span
            className={cn(
              "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900",
              onlineUsers[user.id] ? "bg-green-500" : "bg-gray-400"
            )}
          />
        </div>
        <span>{user.name}</span>
      </div>
      {selected && <div className="text-blue-500">✓</div>}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {!mode
              ? "Create New Chat"
              : mode === "group"
                ? "Create Group"
                : "New Message"}
          </DialogTitle>
        </DialogHeader>

        {!mode ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => setMode("group")}
            >
              <Users className="h-4 w-4 mr-2" />
              Create Group
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => setMode("direct")}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </div>
        ) : mode === "group" ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Add Members</label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              {Object.keys(selectedMembers).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.values(selectedMembers).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full px-2 py-1 text-sm"
                    >
                      <span>{member.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => {
                          const { [member.id]: _, ...rest } = selectedMembers;
                          setSelectedMembers(rest);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                {filteredUsers.map((user) => (
                  <UserItem
                    key={user.id}
                    user={user}
                    selected={!!selectedMembers[user.id]}
                    onClick={() => {
                      if (!selectedMembers[user.id]) {
                        setSelectedMembers({
                          ...selectedMembers,
                          [user.id]: {
                            ...user,
                            role: "member",
                          },
                        });
                      }
                    }}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={
                !groupName.trim() || Object.keys(selectedMembers).length === 0
              }
              onClick={handleCreateGroup}
            >
              Create Group
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {filteredUsers.map((user) => (
                <UserItem
                  key={user.id}
                  user={user}
                  onClick={() => handleCreateDirectMessage(user)}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
