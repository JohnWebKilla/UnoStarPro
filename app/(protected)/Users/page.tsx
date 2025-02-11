"use client";

import { useState, useEffect } from "react";
import { DataTable } from "./data-table";
import { columns, User } from "./columns";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { UserDialog } from "./user-dialog";
import { useToast } from "@/components/ui/use-toast";
import { TableSkeleton } from "./table-skeleton";
import { getUsers, updateUser, updateUserStatus } from "./actions";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let channel: RealtimeChannel;

    const initialize = async () => {
      await fetchUsers();
      channel = await setupRealtimeSubscription();
    };

    initialize();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const setupRealtimeSubscription = async () => {
    const supabase = createClient();

    const channel = supabase
      .channel("users-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        async (payload: any) => {
          console.log("Change received!", payload);

          switch (payload.eventType) {
            case "INSERT":
              setUsers((prevUsers) => [...prevUsers, payload.new as User]);
              toast({
                title: "New User",
                description: "A new user has been added",
              });
              break;

            case "UPDATE":
              setUsers((prevUsers) =>
                prevUsers.map((user) =>
                  user.id === payload.new.id
                    ? { ...user, ...payload.new }
                    : user
                )
              );
              break;

            case "DELETE":
              setUsers((prevUsers) =>
                prevUsers.filter((user) => user.id !== payload.old.id)
              );
              toast({
                title: "User Removed",
                description: "A user has been removed",
              });
              break;
          }
        }
      )
      .subscribe();

    return channel;
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { users: fetchedUsers, error } = await getUsers();

      if (error) {
        throw new Error(error);
      }

      setUsers(fetchedUsers as User[]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      const { user: updatedUser, error } = await updateUserStatus(
        user.id,
        newStatus
      );

      if (error) throw new Error(error);

      if (updatedUser) {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === updatedUser.id ? { ...u, ...updatedUser } : u
          )
        );

        toast({
          title: "Success",
          description: "User status updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async (user: User) => {
    try {
      const { user: updatedUser, error } = await updateUserStatus(
        user.id,
        "active"
      );

      if (error) throw new Error(error);

      if (updatedUser) {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.id === updatedUser.id ? { ...u, ...updatedUser } : u
          )
        );

        toast({
          title: "Success",
          description: "User approved successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  const handleManageCompanies = (user: User) => {
    // This will be implemented with the companies dialog
    console.log("Manage companies for user:", user);
  };

  const handleDialogSuccess = async (updatedUser?: User) => {
    if (updatedUser) {
      // Update the user in the local state
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === updatedUser.id ? { ...u, ...updatedUser } : u
        )
      );
    } else {
      // If no updated user provided, fetch all users
      await fetchUsers();
    }
    handleDialogClose();
  };

  const handleDialogClose = () => {
    setSelectedUser(null);
    setDialogOpen(false);
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users Management</h1>
        <Button onClick={() => setDialogOpen(true)} className="rounded-md">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          onEdit={handleEdit}
          onToggleStatus={handleToggleStatus}
          onApprove={handleApprove}
          onManageCompanies={handleManageCompanies}
        />
      )}

      <UserDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        user={selectedUser}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
