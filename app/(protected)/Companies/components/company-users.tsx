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
import { Loader2, RefreshCw, Users } from "lucide-react";
import { getCompanyUsersOptimized } from "../server-actions";

// Client component to load and display company users
export function CompanyUsers({ company }: { company: Company }) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setError(null);

        // Fetch users from the server action
        const data = await getCompanyUsersOptimized(company.id);
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Failed to load company users. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [company.id]);

  const refreshUsers = async () => {
    setLoading(true);
    try {
      const data = await getCompanyUsersOptimized(company.id);
      setUsers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error("Error refreshing users:", err);
      setError("Failed to refresh company users.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
        <Button
          variant="outline"
          size="icon"
          onClick={refreshUsers}
          disabled={loading}
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

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
            <div className="text-center py-8 text-muted-foreground">
              No users found for this company.
            </div>
          ) : (
            <div className="grid gap-4">
              {users.map((user: any) => (
                <div key={user.id} className="p-4 border rounded-md">
                  <div className="font-medium">{user.email}</div>
                  <div className="text-sm text-muted-foreground">
                    Role: {user.role || "N/A"}
                  </div>
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
export function prefetchCompanyUsers(companyId: number) {
  // This is a client component now, so this function doesn't need to do anything
  console.log(`Prefetch requested for company ${companyId} (client-side only)`);
}
