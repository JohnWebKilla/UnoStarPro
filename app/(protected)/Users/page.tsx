"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { User, UserRole } from "./types";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import { UserDialog } from "./user-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  getUsers,
  updateUser,
  updateUserStatus,
  updateUserCompanyAccess,
} from "./actions";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { CompanyManagement } from "./company-management";
import { Badge } from "@/components/ui/badge";

// Add this interface for the API response
interface UsersApiResponse {
  data: User[];
  source: "cache" | "database";
  timing?: {
    total: number;
    database?: number;
    source?: string;
  };
}

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
  const [dataSource, setDataSource] = useState<"cache" | "database">(
    "database"
  );
  const [isInvalidating, setIsInvalidating] = useState(false);

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
          // Invalidate cache and fetch fresh data
          await invalidateCache();
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
          // Invalidate cache and fetch fresh data
          await invalidateCache();
        }
      )
      .subscribe();

    return channel;
  };

  const fetchUsers = async (skipCache: boolean = false) => {
    try {
      setIsLoading(true);
      const fetchStartTime = Date.now();

      console.log("Fetching users data:", { skipCache });

      // Use the new API endpoint with Redis caching
      const response = await fetch(`/api/users/cached?skipCache=${skipCache}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // Add cache control headers
        cache: skipCache ? "no-store" : "default",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users data");
      }

      const result: UsersApiResponse = await response.json();
      const fetchEndTime = Date.now();
      const fetchTime = fetchEndTime - fetchStartTime;

      console.log("API response:", result);
      setUsers(result.data);
      setDataSource(result.source);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const invalidateCache = async () => {
    try {
      setIsInvalidating(true);
      const response = await fetch(`/api/users/cached`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to invalidate cache");
      }

      toast({
        title: "Success",
        description: "Cache invalidated successfully. Refreshing data...",
      });

      // Fetch fresh data
      await fetchUsers(true);
    } catch (error) {
      console.error("Error invalidating cache:", error);
      toast({
        title: "Error",
        description: "Failed to invalidate cache",
        variant: "destructive",
      });
    } finally {
      setIsInvalidating(false);
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
      await fetchUsers(true);

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
    if (!updatedUser) {
      handleDialogClose(false);
      return;
    }

    // Update UI immediately
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );

    // Close dialog immediately
    handleDialogClose(false);

    toast({
      title: "Success",
      description: "User updated successfully",
    });
  }, []);

  return (
    <div className="px-4 py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex items-center gap-4">
          <Badge
            variant={dataSource === "cache" ? "outline" : "default"}
            className="flex items-center gap-1"
          >
            {dataSource === "cache" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                From Cache
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                From Database
              </>
            )}
          </Badge>
          <Button
            variant="outline"
            onClick={() => invalidateCache()}
            disabled={isLoading || isInvalidating}
            className="flex items-center gap-2"
          >
            {isInvalidating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>Refresh Data</>
            )}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {isLoading ? (
        <DataTable
          columns={columns}
          data={[]}
          isLoading={true}
          skeletonRowCount={5}
          meta={{
            onEdit: handleEdit,
            onToggleStatus: handleToggleStatus,
            onApprove: handleApprove,
            onManageCompanies: handleManageCompanies,
            companies,
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={users}
          isLoading={false}
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
