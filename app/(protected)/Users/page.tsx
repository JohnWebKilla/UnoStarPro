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
import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";

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
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Define invalidateUsersCache before the helper functions that use it
  const invalidateUsersCache = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error("No authenticated user found when invalidating cache");
        return;
      }

      const cacheKey = `users:list:${user.id}`;
      await deleteClientCache(cacheKey);
      console.log("Users cache invalidated:", cacheKey);
    } catch (error) {
      console.error("Error invalidating users cache:", error);
    }
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel;

    const initialize = async () => {
      try {
        console.log("Initializing Users page...");
        await fetchUsers();
        channel = await setupRealtimeSubscription();
        console.log("Real-time subscription initialized successfully");
      } catch (error) {
        console.error("Error initializing Users page:", error);
        toast({
          title: "Error",
          description: "Failed to initialize real-time updates",
          variant: "destructive",
        });
      }
    };

    initialize();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        console.log("Cleaning up real-time subscription");
        const supabase = createClient();
        supabase.removeChannel(channel);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      const supabase = createClient();

      // Log that we're setting up the subscription
      console.log(
        "Setting up real-time subscription for users and user_companies tables"
      );

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

            try {
              // Invalidate the cache immediately when any change occurs
              await invalidateUsersCache();
              console.log("Cache invalidated due to realtime update");

              // After invalidating cache, fetch fresh data
              if (payload.eventType !== "DELETE") {
                // For UPDATE and INSERT, fetch the specific user and update in place
                const { data: updatedUser, error } = await supabase
                  .from("users")
                  .select(
                    `
                    *,
                    user_companies (
                      companies (
                        id,
                        name,
                        status
                      )
                    )
                  `
                  )
                  .eq("id", payload.new.id)
                  .single();

                if (error) {
                  console.error("Error fetching updated user:", error);
                  // If we can't fetch the specific user, refresh the whole list
                  fetchUsers(true);
                  return;
                }

                if (updatedUser) {
                  console.log("Updating user in place:", updatedUser);
                  if (payload.eventType === "INSERT") {
                    await addUserInPlace(updatedUser);
                  } else {
                    await updateUserInPlace(updatedUser);
                  }
                }
              } else {
                // For DELETE, remove the user from the local state
                console.log("Removing user from local state:", payload.old.id);
                await removeUserInPlace(payload.old.id);
              }
            } catch (error) {
              console.error("Error handling user change:", error);
              // If there's an error, refresh the whole list
              fetchUsers(true);
            }
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

            try {
              // Invalidate the cache immediately when any change occurs
              await invalidateUsersCache();
              console.log("Cache invalidated due to user companies update");

              // After invalidating cache, fetch the affected user
              if (payload.eventType !== "DELETE" && payload.new.user_id) {
                const { data: updatedUser, error } = await supabase
                  .from("users")
                  .select(
                    `
                    *,
                    user_companies (
                      companies (
                        id,
                        name,
                        status
                      )
                    )
                  `
                  )
                  .eq("id", payload.new.user_id)
                  .single();

                if (error) {
                  console.error(
                    "Error fetching user after company update:",
                    error
                  );
                  // If we can't fetch the specific user, refresh the whole list
                  fetchUsers(true);
                  return;
                }

                if (updatedUser) {
                  console.log(
                    "Updating user after company change:",
                    updatedUser
                  );
                  await updateUserInPlace(updatedUser);
                }
              } else if (
                payload.eventType === "DELETE" &&
                payload.old.user_id
              ) {
                // For DELETE, we need to fetch the user to get the updated companies list
                const { data: updatedUser, error } = await supabase
                  .from("users")
                  .select(
                    `
                    *,
                    user_companies (
                      companies (
                        id,
                        name,
                        status
                      )
                    )
                  `
                  )
                  .eq("id", payload.old.user_id)
                  .single();

                if (error) {
                  console.error(
                    "Error fetching user after company removal:",
                    error
                  );
                  // If we can't fetch the specific user, refresh the whole list
                  fetchUsers(true);
                  return;
                }

                if (updatedUser) {
                  console.log(
                    "Updating user after company removal:",
                    updatedUser
                  );
                  await updateUserInPlace(updatedUser);
                }
              }
            } catch (error) {
              console.error("Error handling user companies change:", error);
              // If there's an error, refresh the whole list
              fetchUsers(true);
            }
          }
        )
        .subscribe((status) => {
          console.log("Supabase real-time subscription status:", status);
        });

      // Return the channel directly instead of a cleanup function
      return channel;
    } catch (error) {
      console.error("Error setting up real-time subscription:", error);
      toast({
        title: "Error",
        description: "Failed to set up real-time updates",
        variant: "destructive",
      });
      throw error;
    }
  };

  const fetchUsers = async (skipCache: boolean = false) => {
    try {
      setIsLoading(true);
      const fetchStartTime = Date.now();
      const supabase = createClient();

      console.log("Fetching users data:", { skipCache });

      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      // Create a cache key based on the user
      const cacheKey = `users:list:${user.id}`;

      // If skipCache is true, invalidate the cache first
      if (skipCache) {
        await deleteClientCache(cacheKey);
        console.log("Cache invalidated before fetching fresh data");
      }

      // Try to get data from cache first using client-side cache utility
      const { data: cachedData, source } =
        await getClientCache<User[]>(cacheKey);

      if (cachedData && !skipCache) {
        console.log(
          `Users loaded from ${source} in ${Date.now() - fetchStartTime}ms`
        );
        setUsers(cachedData);
        setDataSource(source);
        setLastFetchTime(new Date());
        setIsLoading(false);
        setIsInvalidating(false);
        return;
      }

      // If no cache or skipCache is true, fetch from API
      const response = await fetch(`/api/users`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch users data");
      }

      const usersData = await response.json();
      const fetchEndTime = Date.now();
      const fetchTime = fetchEndTime - fetchStartTime;

      console.log(`Users loaded from database in ${fetchTime}ms`);

      // Store in cache for 5 minutes (300 seconds)
      await setClientCache(cacheKey, usersData, 300);

      setUsers(usersData);
      setDataSource("database");
      setLastFetchTime(new Date());
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsInvalidating(false);
    }
  };

  const invalidateCache = async () => {
    try {
      setIsInvalidating(true);
      toast({
        title: "Refreshing",
        description: "Fetching fresh data from the database...",
      });

      // Use the updated fetchUsers function which handles cache invalidation
      await fetchUsers(true);

      toast({
        title: "Success",
        description: "Data refreshed successfully",
      });
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        title: "Error",
        description: "Failed to refresh data",
        variant: "destructive",
      });
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

      // Invalidate the cache immediately
      await invalidateUsersCache();
      console.log("Cache invalidated due to status toggle");

      if (updatedUser) {
        // Use the helper function to update the user in place
        await updateUserInPlace(updatedUser);
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

      // Invalidate the cache immediately
      await invalidateUsersCache();
      console.log("Cache invalidated due to user approval");

      if (updatedUser) {
        // Use the helper function to update the user in place
        await updateUserInPlace(updatedUser);
      }
    } catch (error) {
      console.error("Error approving user:", error);
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
    selectedCompanyIds: number[],
    isAllAccess: boolean
  ) => {
    if (!userForCompanies) return;

    try {
      console.log("Company update success for user:", userForCompanies.id);
      console.log("Selected company IDs:", selectedCompanyIds);
      console.log("Has all access:", isAllAccess);

      // Invalidate the cache immediately
      await invalidateUsersCache();
      console.log("Cache invalidated due to company access update");

      // Fetch the updated user directly
      const response = await fetch(`/api/users/${userForCompanies.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch updated user");
      }
      const updatedUser = await response.json();
      console.log("Fetched updated user after company update:", updatedUser);

      // Use the helper function to update the user in place
      await updateUserInPlace(updatedUser);

      // Close the dialog
      handleCompanyDialogClose(false);

      // Show success toast
      toast({
        title: "Success",
        description: "Company access updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating user after company access change:", error);

      // Fallback to full refresh if direct update fails
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

  // Helper function to transform user data
  const transformUserData = useCallback((userData: any): User => {
    console.log("Transforming user data:", userData);

    // Extract user_companies if it exists
    const { user_companies, ...userWithoutCompanies } = userData;

    // Process companies if they exist
    let assignedCompanies = [];
    if (user_companies && user_companies.length > 0) {
      assignedCompanies = user_companies
        .filter((uc: any) => uc.companies && uc.companies.status !== "deleted")
        .map((uc: any) => uc.companies);
    }

    // Return the formatted user
    const formattedUser = {
      ...userWithoutCompanies,
      companies: assignedCompanies,
    };

    console.log("Transformed user data:", formattedUser);
    return formattedUser;
  }, []);

  // Add helper functions for updating users in place
  const updateUserInPlace = useCallback(
    async (updatedUser: User) => {
      // Transform the user data if needed
      const formattedUser = transformUserData(updatedUser);
      console.log("Updating user in place with formatted data:", formattedUser);

      // Update the user in the local state
      setUsers((prevUsers) => {
        const userExists = prevUsers.some((u) => u.id === formattedUser.id);
        if (!userExists) {
          console.log("User not found in current list, adding it");
          return [formattedUser, ...prevUsers];
        }
        console.log("User found in current list, updating it");
        return prevUsers.map((u) =>
          u.id === formattedUser.id ? formattedUser : u
        );
      });

      // Highlight the updated user
      setLastUpdatedUserId(formattedUser.id);
      setTimeout(() => setLastUpdatedUserId(null), 2000);

      // Invalidate the cache to ensure it stays in sync
      await invalidateUsersCache();

      // Show a toast notification
      toast({
        title: "User Updated",
        description: `User ${formattedUser.email} was updated`,
      });
    },
    [toast, transformUserData, invalidateUsersCache]
  );

  const addUserInPlace = useCallback(
    async (newUser: User) => {
      // Transform the user data if needed
      const formattedUser = transformUserData(newUser);
      console.log(
        "Adding new user in place with formatted data:",
        formattedUser
      );

      // Add the new user to the local state, avoiding duplicates
      setUsers((prevUsers) => {
        const userExists = prevUsers.some((u) => u.id === formattedUser.id);
        if (userExists) {
          console.log("User already exists in list, updating it");
          return prevUsers.map((u) =>
            u.id === formattedUser.id ? formattedUser : u
          );
        }
        console.log("User does not exist in list, adding it");
        return [formattedUser, ...prevUsers];
      });

      // Highlight the new user
      setLastUpdatedUserId(formattedUser.id);
      setTimeout(() => setLastUpdatedUserId(null), 2000);

      // Invalidate the cache to ensure it stays in sync
      await invalidateUsersCache();

      // Show a toast notification
      toast({
        title: "New User",
        description: `User ${formattedUser.email} was added`,
      });
    },
    [toast, transformUserData, invalidateUsersCache]
  );

  const removeUserInPlace = useCallback(
    async (userId: string) => {
      console.log("Removing user in place with ID:", userId);

      // Check if the user exists before removing
      setUsers((prevUsers) => {
        const userExists = prevUsers.some((u) => u.id === userId);
        if (!userExists) {
          console.log("User not found in current list, no need to remove");
          return prevUsers;
        }
        console.log("User found in current list, removing it");
        return prevUsers.filter((u) => u.id !== userId);
      });

      // Invalidate the cache to ensure it stays in sync
      await invalidateUsersCache();

      // Show a toast notification
      toast({
        title: "User Deleted",
        description: "User was removed",
      });
    },
    [toast, invalidateUsersCache]
  );

  const handleDialogSuccess = useCallback(
    async (updatedUser?: User) => {
      if (!updatedUser) {
        setDialogOpen(false);
        return;
      }

      // Invalidate the cache immediately
      await invalidateUsersCache();
      console.log("Cache invalidated due to user update via dialog");

      // Close dialog immediately
      setDialogOpen(false);

      // Use the helper function to update the user in place
      await updateUserInPlace(updatedUser);
    },
    [updateUserInPlace, invalidateUsersCache]
  );

  // Add a function to render the data source indicator
  const renderDataSourceIndicator = () => {
    return (
      <div className="text-xs text-muted-foreground mt-1">
        Data source: {dataSource === "cache" ? "Cache" : "Database"}
        {lastFetchTime && (
          <span className="ml-2">
            • Last updated: {lastFetchTime.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="px-2 py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
          {renderDataSourceIndicator()}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={invalidateCache}
            disabled={isInvalidating}
          >
            {isInvalidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh Data"
            )}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading || isInvalidating}
        lastUpdatedUserId={lastUpdatedUserId}
        meta={{
          onEdit: handleEdit,
          onToggleStatus: handleToggleStatus,
          onApprove: handleApprove,
          onManageCompanies: handleManageCompanies,
          companies,
        }}
      />

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
