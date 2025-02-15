"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { User, UserRole } from "./types";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { UserDialog } from "./user-dialog";
import { useToast } from "@/components/ui/use-toast";
import { TableSkeleton } from "./table-skeleton";
import {
  getUsers,
  updateUser,
  updateUserStatus,
  updateUserCompanyAccess,
} from "./actions";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { CompanyManagement } from "./company-management";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [userForCompanies, setUserForCompanies] = useState<User | null>(null);
  const [companies, setCompanies] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [lastUpdatedUserId, setLastUpdatedUserId] = useState<string | null>(
    null
  );

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

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch("/api/companies");
        if (!response.ok) throw new Error("Failed to fetch companies");
        const data = await response.json();
        setCompanies(data);
      } catch (error) {
        console.error("Error fetching companies:", error);
        toast({
          title: "Error",
          description: "Failed to load companies",
          variant: "destructive",
        });
      }
    };

    fetchCompanies();
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
          console.log("Users change received!", payload);
          const { users: updatedUsers, error } = await getUsers();
          if (error || !updatedUsers) return;
          setUsers(updatedUsers);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_companies",
        },
        async (payload: any) => {
          console.log("User companies change received!", payload);
          const { users: updatedUsers, error } = await getUsers();
          if (error || !updatedUsers) return;
          setUsers(updatedUsers);
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

  const handleEdit = useCallback((user: User) => {
    setSelectedUser(user);
    setDialogOpen(true);
  }, []);

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
    setUserForCompanies(user);
    setCompanyDialogOpen(true);
  };

  const handleCompanyDialogClose = (open: boolean) => {
    setCompanyDialogOpen(open);
    if (!open) {
      // Wait for dialog animation to complete
      setTimeout(() => {
        setUserForCompanies(null);
      }, 300);
    }
  };

  const handleCompanyUpdateSuccess = async (
    updatedCompanyIds: number[],
    hasAllAccess: boolean
  ) => {
    if (!userForCompanies) return;

    // Update UI immediately
    const optimisticUser: User = {
      ...userForCompanies,
      has_all_access: hasAllAccess,
      companies: companies
        .filter((c) => updatedCompanyIds.includes(c.id))
        .map((c) => ({ ...c, status: "active" })),
    };

    // Update local state and close dialog immediately
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === optimisticUser.id ? optimisticUser : u))
    );
    setCompanyDialogOpen(false);

    try {
      // Make the API call in the background
      const result = await updateUserCompanyAccess(
        userForCompanies.id,
        hasAllAccess ? null : updatedCompanyIds,
        hasAllAccess
      );

      if (result.error) {
        throw new Error(result.error);
      }

      // Show success message
      toast({
        title: "Success",
        description: "Company access updated successfully",
      });
    } catch (error: any) {
      // On error, revert the optimistic update
      const { users: revertUsers } = await getUsers();
      if (revertUsers) {
        setUsers(revertUsers);
      }

      toast({
        title: "Error",
        description: error.message || "Failed to update company access",
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setDialogOpen(false);
      // Wait for the dialog to animate out before clearing the selected user
      setTimeout(() => {
        setSelectedUser(null);
      }, 300);
    }
  }, []);

  const handleDialogSuccess = useCallback(async (updatedUser?: User) => {
    handleDialogClose(false);
  }, []);

  return (
    <div className="px-4 py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          meta={{
            onEdit: handleEdit,
            onToggleStatus: handleToggleStatus,
            onApprove: handleApprove,
            onManageCompanies: handleManageCompanies,
            companies,
          }}
        />
      )}

      <UserDialog
        key={selectedUser?.id || "new"}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        user={selectedUser || undefined}
        onSuccess={handleDialogSuccess}
        companies={companies}
      />

      {userForCompanies && (
        <CompanyManagement
          open={companyDialogOpen}
          onOpenChange={handleCompanyDialogClose}
          userId={userForCompanies.id}
          userRole={userForCompanies.role}
          currentCompanyIds={
            userForCompanies.companies
              ? userForCompanies.companies.map((c) => c.id)
              : []
          }
          hasAllAccess={userForCompanies.has_all_access}
          companies={companies}
          userName={`${userForCompanies.first_name} ${userForCompanies.last_name}`}
          onSuccess={handleCompanyUpdateSuccess}
        />
      )}
    </div>
  );
}
