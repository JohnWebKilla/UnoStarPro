"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings,
  UserPlus,
  Shield,
  ShieldOff,
  UserMinus,
  Crown,
} from "lucide-react";
import { ChatGroup } from "./types";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

interface GroupManagementProps {
  group: ChatGroup;
  currentUser: {
    id: string;
    name: string;
    image?: string;
  };
  onUpdateGroup: (groupId: string, updates: any) => void;
  onAddMember: (groupId: string, memberId: string) => void;
  onRemoveMember: (groupId: string, memberId: string) => void;
  onPromoteToAdmin: (groupId: string, memberId: string) => void;
  onDemoteFromAdmin: (groupId: string, memberId: string) => void;
}

export function GroupManagement({
  group,
  currentUser,
  onUpdateGroup,
  onAddMember,
  onRemoveMember,
  onPromoteToAdmin,
  onDemoteFromAdmin,
}: GroupManagementProps) {
  const [newMemberName, setNewMemberName] = useState("");
  const [groupName, setGroupName] = useState(group.name);
  const isAdmin =
    group.members.find((m) => m.id === currentUser.id)?.role === "admin";
  const onlineUsers = useOnlineStatus();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Group Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Group Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Group Name</label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onBlur={() => onUpdateGroup(group.id, { name: groupName })}
              disabled={!isAdmin}
            />
          </div>

          {/* Add Member */}
          {isAdmin && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Add Member</label>
              <div className="flex gap-2">
                <Input
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Enter member name"
                />
                <Button
                  onClick={() => {
                    if (newMemberName) {
                      onAddMember(group.id, newMemberName);
                      setNewMemberName("");
                    }
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Members ({group.members.length})
            </label>
            <div className="space-y-2">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="h-8 w-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900",
                          onlineUsers[member.id]
                            ? "bg-green-500"
                            : "bg-gray-400"
                        )}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm">{member.name}</span>
                      <span className="text-xs text-gray-500">
                        {onlineUsers[member.id] ? "Online" : "Offline"}
                      </span>
                    </div>
                    {member.role === "admin" && (
                      <Crown className="h-4 w-4 text-yellow-500 ml-2" />
                    )}
                  </div>
                  {isAdmin && member.id !== currentUser.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          •••
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role === "admin" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              onDemoteFromAdmin(group.id, member.id)
                            }
                          >
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Remove Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              onPromoteToAdmin(group.id, member.id)
                            }
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onRemoveMember(group.id, member.id)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
