"use client";

import { useState } from "react";
import {
  Settings,
  Users,
  UserPlus,
  UserMinus,
  ChevronLeft,
  Edit,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Member {
  id: string;
  name: string;
  role: "admin" | "member";
  type: "driver" | "user";
}

interface GroupSettingsProps {
  groupId: string;
  groupName: string;
  members: Member[];
  userRole: "admin" | "driver" | "user";
  onUpdateGroup: (groupId: string, updates: any) => void;
  onAddMember: (groupId: string, memberId: string) => void;
  onRemoveMember: (groupId: string, memberId: string) => void;
}

export function GroupSettings({
  groupId,
  groupName,
  members,
  userRole,
  onUpdateGroup,
  onAddMember,
  onRemoveMember,
}: GroupSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newGroupName, setNewGroupName] = useState(groupName);
  const [showAddMembers, setShowAddMembers] = useState(false);

  const canManageGroup = userRole === "admin";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Group Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {/* Group Name */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Group Name</h3>
              {canManageGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isEditing ? (
              <div className="flex gap-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="h-8"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    onUpdateGroup(groupId, { name: newGroupName });
                    setIsEditing(false);
                  }}
                >
                  Save
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{groupName}</p>
            )}
          </div>

          {/* Members List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Members ({members.length})
              </h3>
              {canManageGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddMembers(!showAddMembers)}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-800"
                >
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-gray-500">
                      {member.type.charAt(0).toUpperCase() +
                        member.type.slice(1)}{" "}
                      • {member.role}
                    </p>
                  </div>
                  {canManageGroup && member.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveMember(groupId, member.id)}
                    >
                      <UserMinus className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Members Dialog */}
          {showAddMembers && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full">Add Members</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Members</DialogTitle>
                </DialogHeader>
                <div className="pt-4">
                  <Input
                    placeholder="Search users or drivers..."
                    className="mb-4"
                  />
                  {/* Add member selection UI here */}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Delete Group Option */}
          {canManageGroup && (
            <div className="pt-4 border-t">
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Group
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
