"use client";

import { useState, useEffect } from "react";
import { Company } from "../types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, RefreshCw, Users, UserPlus } from "lucide-react";
import {
  getCompanyUsersOptimized,
  addTestUserToCompany,
} from "../server-actions";
import React from "react";

// Client component to load and display company users
export function CompanyUsers({ company }: { company: Company }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [isAddingTestUser, setIsAddingTestUser] = useState(false);

  // Use this flag to track if component is visible
  const [isVisible, setIsVisible] = useState(true); // Default to true for immediate loading

  // For debugging
  const companyId = company?.id;

  useEffect(() => {
    console.log(`[CompanyUsers] Component mounted for company ${companyId}`);

    // Immediately load the data when component mounts
    if (!hasAttemptedLoad) {
      console.log(`[CompanyUsers] Initial load for company ${companyId}`);
      loadUsers();
    }

    return () => {
      console.log(
        `[CompanyUsers] Component unmounted for company ${companyId}`
      );
    };
  }, [companyId, hasAttemptedLoad]);

  // Function to load users data
  const loadUsers = async () => {
    try {
      console.log(`[CompanyUsers] Loading users for company ${companyId}`);
      setLoading(true);
      setError(null);
      setHasAttemptedLoad(true);

      // Direct API fetch as a fallback to ensure we get the most up-to-date data
      const response = await fetch(`/api/companies/${companyId}/users`);
      const apiData = await response.json();

      if (apiData.error) {
        throw new Error(apiData.error);
      }

      console.log(`[CompanyUsers] API returned users data:`, apiData);

      if (Array.isArray(apiData.users)) {
        setUsers(apiData.users);
        console.log(
          `[CompanyUsers] Set ${apiData.users.length} users for company ${companyId}`
        );
      } else {
        console.log(
          `[CompanyUsers] No user data or invalid format from API:`,
          apiData
        );
        setUsers([]);
      }
    } catch (err) {
      console.error(
        `[CompanyUsers] Error loading users for company ${companyId}:`,
        err
      );
      setError(
        `Failed to load company users: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshUsers = async () => {
    console.log(`[CompanyUsers] Refreshing users for company ${companyId}`);
    setLoading(true);
    try {
      // Direct API fetch for consistency
      const response = await fetch(`/api/companies/${companyId}/users`);
      const apiData = await response.json();

      if (apiData.error) {
        throw new Error(apiData.error);
      }

      console.log(`[CompanyUsers] API refresh returned:`, apiData);

      if (Array.isArray(apiData.users)) {
        setUsers(apiData.users);
        console.log(
          `[CompanyUsers] Refreshed ${apiData.users.length} users for company ${companyId}`
        );
      } else {
        console.log(`[CompanyUsers] No user data after refresh:`, apiData);
        setUsers([]);
      }
      setError(null);
    } catch (err) {
      console.error(`[CompanyUsers] Error refreshing users:`, err);
      setError(
        `Failed to refresh company users: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };

  const addTestUser = async () => {
    try {
      setIsAddingTestUser(true);
      console.log(
        `[CompanyUsers] Adding test user for company ${companyId}...`
      );
      const result = await addTestUserToCompany(companyId);

      if (result.success) {
        console.log(
          `[CompanyUsers] Test user added successfully: ${result.message}`
        );
        // Refresh the user list after a short delay to allow revalidation
        setTimeout(() => refreshUsers(), 300);
      } else {
        console.error(
          `[CompanyUsers] Failed to add test user: ${result.error}`
        );
        setError(`Failed to add test user: ${result.error}`);
      }
    } catch (err) {
      console.error(`[CompanyUsers] Error adding test user:`, err);
      setError(
        `Error adding test user: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsAddingTestUser(false);
    }
  };

  return (
    <div className="space-y-6" id={`company-users-${companyId}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Company Users</h3>
            <p className="text-sm text-muted-foreground">
              Manage users associated with {company.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={refreshUsers}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
          >
            Debug: {debugMode ? "On" : "Off"}
          </Button>
        </div>
      </div>

      {debugMode && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4 space-y-2 text-xs">
            <div>
              <strong>Company ID:</strong> {companyId}
            </div>
            <div>
              <strong>User Count:</strong> {users.length}
            </div>
            <div>
              <strong>Loading:</strong> {loading ? "Yes" : "No"}
            </div>
            <div>
              <strong>Error:</strong> {error || "None"}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={addTestUser}
                disabled={isAddingTestUser}
              >
                {isAddingTestUser ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-3 w-3" />
                    Add Test User
                  </>
                )}
              </Button>
            </div>
            <div>
              <strong>Raw Users Data:</strong>
            </div>
            <pre className="bg-background p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(users, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <CardDescription>
            {users.length} {users.length === 1 ? "user" : "users"} associated
            with this company
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-muted-foreground">
                No users found for this company. Users need to be added through
                the Users section.
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    (window.location.href = "/Users?company=" + company.id)
                  }
                >
                  <Users className="h-4 w-4 mr-2" />
                  Go to Users Section
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTestUser}
                  disabled={isAddingTestUser}
                >
                  {isAddingTestUser ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Test User...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Test User
                    </>
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-4">
                Company users are managed through the user_companies table in
                the database.
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {users.map((user: any) => (
                <div key={user.id} className="p-4 border rounded-md">
                  <div className="font-medium">{user.email}</div>
                  <div className="text-sm text-muted-foreground">
                    Role: {user.role || "N/A"}
                  </div>
                  {user.first_name || user.last_name ? (
                    <div className="text-sm text-muted-foreground">
                      Name: {user.first_name || ""} {user.last_name || ""}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Function to prefetch company users data
export function prefetchCompanyUsers(companyId: number): Promise<void> {
  if (typeof window !== "undefined") {
    console.log(`[Prefetch] Starting prefetch for company ${companyId}`);

    // Check if we've already prefetched by checking sessionStorage
    const prefetchKey = `company_users_prefetched_${companyId}`;
    const alreadyPrefetched = sessionStorage.getItem(prefetchKey);

    if (alreadyPrefetched) {
      console.log(
        `[Prefetch] Already prefetched data for company ${companyId}`
      );
      return Promise.resolve();
    }

    // Prefetch data in the background
    return getCompanyUsersOptimized(companyId)
      .then((data) => {
        // Handle both legacy and new API format
        const userCount = Array.isArray(data)
          ? data.length
          : data?.users
            ? data.users.length
            : 0;

        console.log(
          `[Prefetch] Successfully prefetched ${userCount} users for company ${companyId}`
        );
        // Mark as prefetched
        sessionStorage.setItem(prefetchKey, "true");
      })
      .catch((err) => {
        console.error(`[Prefetch] Error prefetching company users: ${err}`);
      });
  }

  return Promise.resolve();
}
