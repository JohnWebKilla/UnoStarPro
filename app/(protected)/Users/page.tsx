"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { User, UserRole } from "./types";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, RefreshCw, Database, Trash } from "lucide-react";
import { UserDialog } from "./user-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  getUsers,
  getUser,
  clearUserCaches,
  CacheResponse,
} from "./optimized-actions";
import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { CompanyManagement } from "./company-management";
import { Badge } from "@/components/ui/badge";
import {
  getClientCache,
  setClientCache,
  deleteClientCache,
} from "@/utils/client-cache";
import { getEmployeeSchedule } from "../Scheduling/actions";
import {
  updateUser,
  updateUserStatus,
  updateUserCompanyAccess,
} from "./actions";

// Update the UsersApiResponse type to match our new CacheResponse type
interface UsersApiResponse extends CacheResponse<User[]> {}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [dataSource, setDataSource] = useState<string>("database");
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [timingInfo, setTimingInfo] = useState<{ total: number } | null>(null);

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
      console.log("Fetching users data:", { skipCache });

      // Use our new optimized getUsers function
      const result = await getUsers(skipCache);

      setUsers(result.data);

      // Set the data source based on the cache location
      setDataSource(
        result.source === "cache"
          ? result.timing.source === "client-cache"
            ? "Client Cache (API)"
            : result.timing.source === "local-storage"
              ? "Client Cache (Local)"
              : "Redis Cache"
          : "Database"
      );

      setLastFetchTime(new Date());
      setTimingInfo(result.timing);
      console.log(
        `Users loaded from ${result.source} (${result.timing.source}) in ${result.timing.total.toFixed(2)}ms`
      );
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

      // Clear all caches first
      await clearUserCaches();
      console.log("All user caches cleared");

      // Then fetch fresh data
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

  // Handle edit user
  const handleEdit = useCallback((user: User) => {
    console.log("Edit user:", user);
    setSelectedUser(user);
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

    // Ensure schedule data is preserved
    const working_shift =
      userData.working_shift ||
      (userData.user_metadata && userData.user_metadata.working_shift) ||
      "1";

    const off_days = userData.off_days ||
      (userData.user_metadata && userData.user_metadata.off_days) || [
        "saturday",
        "sunday",
      ];

    // Return the formatted user
    const formattedUser = {
      ...userWithoutCompanies,
      companies: assignedCompanies,
      working_shift,
      off_days,
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

      // Ensure schedule data is preserved
      console.log("Schedule data being preserved:", {
        working_shift: formattedUser.working_shift,
        off_days: formattedUser.off_days,
      });

      // Update the user in the local state
      setUsers((prevUsers) => {
        const userExists = prevUsers.some((u) => u.id === formattedUser.id);
        if (!userExists) {
          console.log("User not found in current list, adding it");
          return [formattedUser, ...prevUsers];
        }
        console.log("User found in current list, updating it");
        return prevUsers.map((u) => {
          if (u.id === formattedUser.id) {
            // Ensure we preserve the schedule data
            return {
              ...formattedUser,
              working_shift: formattedUser.working_shift || u.working_shift,
              off_days: formattedUser.off_days || u.off_days,
            };
          }
          return u;
        });
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
      console.log("Dialog success with user:", updatedUser);
      setSelectedUser(null);

      if (updatedUser) {
        // Log schedule information specifically
        console.log("Updated user schedule data:", {
          working_shift: updatedUser.working_shift,
          off_days: updatedUser.off_days,
        });

        // Use the helper function to update the user in place
        await updateUserInPlace(updatedUser);

        // Invalidate the cache
        await invalidateUsersCache();

        // Show a toast notification
        toast({
          title: "Success",
          description: `User ${updatedUser.email} was ${
            selectedUser ? "updated" : "created"
          }`,
        });

        // Highlight the updated row briefly
        setLastUpdatedUserId(updatedUser.id);
        setTimeout(() => {
          setLastUpdatedUserId(null);
        }, 1000);
      }
    },
    [updateUserInPlace, invalidateUsersCache, toast, selectedUser]
  );

  // Add a refresh function similar to the Drivers page
  const handleRefresh = async (useCache: boolean = true) => {
    try {
      setIsInvalidating(true);
      // Use skipCache = !useCache to match the Drivers pattern
      await fetchUsers(!useCache);
    } finally {
      setIsInvalidating(false);
    }
  };

  // Add a function to render the data source indicator with badge
  const renderDataSourceIndicator = () => {
    // Match the style from DriversHeader component
    const getDataSourceColor = () => {
      if (dataSource === "Database")
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      if (dataSource === "Redis Cache")
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      if (dataSource === "Client Cache (API)")
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      if (dataSource === "Client Cache (Local)")
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    };

    return (
      <Badge
        variant="outline"
        className={`${getDataSourceColor()} flex items-center gap-1 ml-2`}
      >
        <Database className="h-3 w-3" />
        {dataSource}
        {lastFetchTime && timingInfo && (
          <span className="ml-1 text-xs">
            ({(timingInfo.total / 1000).toFixed(2)}s)
          </span>
        )}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              Manage user accounts and permissions
            </p>
            {!isLoading && renderDataSourceIndicator()}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-9 relative z-0"
            onClick={invalidateCache}
            disabled={isInvalidating || isLoading}
          >
            Clear Cache
          </Button>
          {/* Always render the UserDialog */}
          <UserDialog
            key={selectedUser?.id || "new"}
            user={selectedUser || undefined}
            onSuccess={handleDialogSuccess}
            companies={companies}
            onUserAdded={() => fetchUsers(true)}
          />
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
