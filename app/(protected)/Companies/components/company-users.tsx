import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Users,
  Loader2,
  Trash2,
  UserPlus,
  Mail,
  Shield,
  CalendarClock,
  Search,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Company } from "../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import {
  getCompanyUsersAction,
  getCompanyUsersOptimized,
  clearCompanyUsersCache,
} from "../server-actions";

// Prefetch cache for users
const usersPrefetchCache = new Map<number, boolean>();

// Client-side cache for users to prevent expensive reloads
interface UserCache {
  users: CompanyUser[];
  timestamp: number;
  loadTime: number;
}

const userCache = new Map<number, UserCache>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL

const userFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "manager", "user"], {
    required_error: "Please select a role",
  }),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface CompanyUser {
  id: string;
  email: string;
  role: "admin" | "manager" | "user";
  created_at: string;
  first_name: string;
  last_name: string;
  status: string;
}

interface CompanyUsersProps {
  company: Company;
}

export function CompanyUsers({ company }: CompanyUsersProps) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      role: "user",
    },
  });

  const fetchUsers = async (showLoading = true) => {
    try {
      // Check client-side cache first
      const now = Date.now();
      const cachedData = userCache.get(company.id);

      // Use cache if it's valid and not explicitly refreshing
      if (cachedData && now - cachedData.timestamp < CACHE_TTL && !refreshing) {
        console.log(
          `Using client-side cached users for company ${company.id} (${cachedData.users.length} users)`
        );
        setUsers(cachedData.users);
        setLoadTime(cachedData.loadTime);
        setLoading(false);
        return;
      }

      if (showLoading) {
        setLoading(true);
        setLoadingError(null);
      }

      const startTime = performance.now();

      // Use the optimized function instead of the original
      const companyUsers = await getCompanyUsersOptimized(company.id);

      const endTime = performance.now();
      const actualLoadTime = Math.round(endTime - startTime);

      if (showLoading) {
        setLoadTime(actualLoadTime);
      }

      setUsers(companyUsers);

      // Save to client-side cache
      userCache.set(company.id, {
        users: companyUsers,
        timestamp: now,
        loadTime: actualLoadTime,
      });
    } catch (error) {
      console.error("Error fetching company users:", error);
      if (showLoading) {
        setLoadingError("Failed to load users. Please try again later.");
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Mark as prefetched
    if (usersPrefetchCache.has(company.id)) {
      console.log(`Company ${company.id} users were prefetched`);
    }

    // Set a flag to prevent duplicate loads
    usersPrefetchCache.set(company.id, true);
    fetchUsers();
  }, [company.id]);

  const onSubmit = async (data: UserFormValues) => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Add new user
      const newUser: CompanyUser = {
        id: Math.random().toString(36).substring(7),
        email: data.email,
        role: data.role,
        created_at: new Date().toISOString(),
        first_name: "",
        last_name: "",
        status: "active",
      };

      setUsers([...users, newUser]);
      form.reset();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error adding user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Remove user
      setUsers(users.filter((user) => user.id !== userId));
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = searchQuery
    ? users.filter((user) =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800";
      case "manager":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  // Function to refresh users and invalidate cache
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchUsers(true);
    } catch (error) {
      console.error("Error refreshing users:", error);
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="user@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="mt-6">
                    <Button type="submit" disabled={loading}>
                      {loading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add User
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">User List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <CardDescription>
            {filteredUsers.length}{" "}
            {filteredUsers.length === 1 ? "user" : "users"} associated with{" "}
            {company.name}
            {loadTime && !loading && (
              <span className="ml-2 text-xs text-muted-foreground">
                (loaded in {loadTime}ms)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted/50 p-3 mb-4">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                </div>
                <h3 className="text-lg font-medium mb-1">Loading users...</h3>
                <p className="text-sm text-muted-foreground">
                  This may take a moment
                </p>
              </div>
            ) : loadingError ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-destructive/10 p-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  Error loading users
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {loadingError}
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : filteredUsers.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getRoleBadgeColor(user.role)}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {user.role.charAt(0).toUpperCase() +
                            user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatDate(user.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted/50 p-3 mb-4">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No users found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery
                    ? `No users match "${searchQuery}"`
                    : "This company doesn't have any users yet."}
                </p>
                {!searchQuery && (
                  <Button variant="outline" onClick={() => setDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First User
                  </Button>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Add a prefetch function that can be exported and used by other components
export function prefetchCompanyUsers(companyId: number) {
  if (usersPrefetchCache.has(companyId)) return;

  // Mark as being prefetched to avoid duplicate requests
  usersPrefetchCache.set(companyId, true);

  // Start fetching in the background
  getCompanyUsersAction(companyId).catch((error) => {
    console.error("Error prefetching company users:", error);
    // Remove from cache on error to allow retry
    usersPrefetchCache.delete(companyId);
  });
}
