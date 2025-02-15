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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Member {
  id: string;
  name: string;
  role: "admin" | "member";
  type: "driver" | "user";
}

interface CreateChatProps {
  onCreateGroup: (data: { name: string; members: Member[] }) => void;
  onCreateDirectMessage: (userId: string) => void;
  availableMembers: Member[];
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    image?: string;
  };
}

export function CreateChat({
  onCreateGroup,
  onCreateDirectMessage,
  availableMembers,
  onClose,
  currentUser,
}: CreateChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"group" | "direct" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);

  const onlineUsers = useOnlineStatus();

  const filteredMembers = availableMembers.filter(
    (member) =>
      member.id !== currentUser.id &&
      member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) return;

    onCreateGroup({
      name: groupName,
      members: [
        {
          id: currentUser.id,
          name: currentUser.name,
          role: "admin" as const,
          type: "user" as const,
        },
        ...selectedMembers,
      ],
    });
    onClose();
  };

  const handleDirectMessage = (member: Member) => {
    onCreateDirectMessage(member.id);
    onClose();
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>

            <div>
              <Label>Select Members</Label>
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="space-y-4">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={selectedMembers.some(
                          (m) => m.id === member.id
                        )}
                        onCheckedChange={() => {
                          setSelectedMembers((prev) =>
                            prev.some((m) => m.id === member.id)
                              ? prev.filter((m) => m.id !== member.id)
                              : [...prev, member]
                          );
                        }}
                      />
                      <label
                        htmlFor={`member-${member.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {member.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!groupName.trim() || selectedMembers.length === 0}
              >
                Create Group
              </Button>
            </div>
          </form>
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
              {filteredMembers.map((user) => (
                <UserItem
                  key={user.id}
                  user={user}
                  onClick={() => handleDirectMessage(user)}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
