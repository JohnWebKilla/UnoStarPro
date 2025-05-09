"use client";

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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Truck,
  Loader2,
  Phone,
  Mail,
  UserPlus,
  CalendarClock,
  Search,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Pencil,
  Building,
  PowerOff,
  Power,
  DollarSign,
  Users,
  Calendar,
  FileText,
  Upload,
  FileCheck,
  AlertCircle,
  Clock,
  FileWarning,
  RefreshCw,
  AlertTriangle,
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";

const driverFormSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  phone_number: z.string().min(10, "Phone number must be at least 10 digits"),
  solo_or_team: z.enum(["SOLO", "TEAM"], {
    required_error: "Please select solo or team",
  }),
  truck_number: z.string().min(1, "Truck number is required"),
  subscription_amount: z.coerce.number().min(1, "Price per driver is required"),
  status: z.enum(["active", "inactive"], {
    required_error: "Please select a status",
  }),
  hire_date: z.string().optional(),
  mvr_file: z.any().optional(),
  mvr_expiration: z.string().optional(),
  medical_card: z.any().optional(),
  medical_card_expiration: z.string().optional(),
  license_file: z.any().optional(),
  license_number: z.string().optional(),
  license_state: z.string().optional(),
  license_expiration: z.string().optional(),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

type DriverStatus = "active" | "inactive" | "terminated" | "pending";

interface CompanyDriver {
  id: string;
  name: string;
  phone_number?: string;
  phone?: string; // For compatibility with API
  solo_or_team?: string;
  type?: string; // For compatibility with API
  truck_number?: string;
  truckNumber?: string; // For compatibility with API
  subscription_amount?: number;
  price_amount?: number; // For compatibility with API
  status: DriverStatus;
  company_id: number;
  company_name?: string;
  stripe_product_id?: string;
  hire_date?: string;
  terminated_date?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string; // For compatibility with API
  updatedAt?: string; // For compatibility with API
}

interface CompanyDriversProps {
  company: Company;
}

export function CompanyDrivers({ company }: CompanyDriversProps) {
  const [drivers, setDrivers] = useState<CompanyDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<CompanyDriver | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    fetchDrivers();
  }, [company.id]);

  async function fetchDrivers() {
    try {
      setLoading(true);
      setError(null);

      // Fetch drivers using Supabase client
      const supabase = createClient();

      const { data, error } = await supabase
        .from("drivers")
        .select(
          `
          *,
          companies:company_id (
            id,
            name
          )
        `
        )
        .eq("company_id", company.id);

      if (error) {
        throw error;
      }

      // Transform data to match our component's expected format
      const transformedDrivers = data.map((driver) => ({
        id: driver.id,
        name: driver.name,
        phone_number: driver.phone_number || driver.phone,
        solo_or_team: driver.solo_or_team || driver.type,
        truck_number: driver.truck_number || driver.truckNumber,
        subscription_amount: driver.subscription_amount || driver.price_amount,
        status: driver.status as DriverStatus,
        company_id: driver.company_id,
        company_name: driver.companies?.name || "Unknown Company",
        stripe_product_id: driver.stripe_product_id,
        hire_date: driver.hire_date,
        terminated_date: driver.terminated_date,
        created_at: driver.created_at || driver.createdAt,
        updated_at: driver.updated_at || driver.updatedAt,
      }));

      setDrivers(transformedDrivers);
    } catch (err) {
      console.error("Error fetching drivers:", err);
      setError("Failed to load drivers. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDrivers();
  };

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: "",
      phone_number: "",
      solo_or_team: "SOLO",
      truck_number: "",
      subscription_amount: 250,
      status: "active",
      hire_date: new Date().toISOString().split("T")[0],
    },
  });

  const createStripeProduct = async (driver: Partial<CompanyDriver>) => {
    // This would be an API call to your backend
    console.log("Creating Stripe product for driver:", driver);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Return mock Stripe product ID
    return `prod_${Math.random().toString(36).substring(2, 10)}`;
  };

  const onSubmit = async (data: DriverFormValues) => {
    try {
      setLoading(true);

      // Create or update driver in database and Stripe
      let stripeProductId: string | undefined;

      if (!editingDriver) {
        // Create new Stripe product for the driver
        stripeProductId = await createStripeProduct({
          name: data.name,
          subscription_amount: data.subscription_amount,
          company_id: company.id,
        });
      } else {
        stripeProductId = editingDriver.stripe_product_id;
      }

      if (editingDriver) {
        // Update existing driver
        const updatedDriver = {
          ...editingDriver,
          ...data,
          updated_at: new Date().toISOString(),
        };

        setDrivers(
          drivers.map((driver) =>
            driver.id === editingDriver.id ? updatedDriver : driver
          )
        );
        toast.success("Driver updated successfully");
      } else {
        // Add new driver
        const newDriver: CompanyDriver = {
          id: Math.random().toString(36).substring(7),
          ...data,
          company_id: company.id,
          stripe_product_id: stripeProductId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setDrivers([...drivers, newDriver]);
        toast.success("Driver added successfully");
      }

      form.reset();
      setDialogOpen(false);
      setEditingDriver(null);
    } catch (error) {
      console.error("Error saving driver:", error);
      toast.error("Failed to save driver");
    } finally {
      setLoading(false);
    }
  };

  const validateSoloOrTeam = (
    value: string | undefined
  ): "SOLO" | "TEAM" | undefined => {
    if (value === "SOLO" || value === "TEAM") {
      return value;
    }
    return "SOLO"; // Default to SOLO if the value is not valid
  };

  const validateStatus = (
    status: string | undefined
  ): "active" | "inactive" | undefined => {
    if (status === "active" || status === "inactive") {
      return status;
    }
    return "active"; // Default to active if the value is not valid
  };

  const handleEditDriver = (driver: CompanyDriver) => {
    setEditingDriver(driver);
    form.reset({
      name: driver.name,
      phone_number: driver.phone_number || driver.phone || "",
      solo_or_team: validateSoloOrTeam(driver.solo_or_team || driver.type),
      truck_number: driver.truck_number || driver.truckNumber || "",
      subscription_amount:
        driver.subscription_amount || driver.price_amount || 250,
      status: validateStatus(driver.status),
      hire_date: driver.hire_date ? driver.hire_date.split("T")[0] : undefined,
    });
    setDialogOpen(true);
  };

  const handleSwapCompany = (driver: CompanyDriver) => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      toast.success(`Initiated company transfer for ${driver.name}`);
      setLoading(false);
    }, 1000);
  };

  const handleToggleStatus = async (driver: CompanyDriver) => {
    try {
      setLoading(true);

      const newStatus: DriverStatus =
        driver.status === "active" ? "inactive" : "active";

      // Update driver status in Supabase
      const supabase = createClient();
      const { data, error } = await supabase
        .from("drivers")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          terminated_date:
            newStatus === "inactive" ? new Date().toISOString() : null,
        })
        .eq("id", driver.id)
        .select();

      if (error) {
        throw error;
      }

      // Update local state
      setDrivers(
        drivers.map((d) =>
          d.id === driver.id
            ? {
                ...d,
                status: newStatus,
                updated_at: new Date().toISOString(),
                terminated_date:
                  newStatus === "inactive"
                    ? new Date().toISOString()
                    : undefined,
              }
            : d
        )
      );

      // Clear Drivers cache to ensure status change is reflected across the application
      try {
        // Import the server action to clear driver caches
        const { clearDriverCachesAction } = await import(
          "../../Drivers/server-actions"
        );
        await clearDriverCachesAction();
        console.log(
          `Cleared drivers cache after status update for driver ${driver.id}`
        );
      } catch (cacheError) {
        console.error("Error clearing drivers cache:", cacheError);
        // Continue even if cache clearing fails
      }

      toast.success(
        `Driver ${driver.name} ${newStatus === "active" ? "activated" : "deactivated"}`
      );
    } catch (err) {
      console.error("Error updating driver status:", err);
      toast.error("Failed to update driver status");
    } finally {
      setLoading(false);
    }
  };

  const filteredDrivers = searchQuery
    ? drivers.filter(
        (driver) =>
          driver.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          driver.phone_number?.includes(searchQuery) ||
          driver.truck_number?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : drivers;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-full bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Company Drivers</h3>
            <p className="text-sm text-muted-foreground">
              Manage drivers associated with {company.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            title="Refresh drivers list"
          >
            <RefreshCw
              className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingDriver(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Driver
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Truck Driver List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search drivers..."
                className="w-full pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <CardDescription>
            {filteredDrivers.length}{" "}
            {filteredDrivers.length === 1 ? "driver" : "drivers"} associated
            with {company.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted/50 p-3 mb-4">
                  <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                </div>
                <h3 className="text-lg font-medium mb-1">Loading drivers...</h3>
                <p className="text-sm text-muted-foreground">
                  This may take a moment
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-destructive/10 p-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  Error loading drivers
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : filteredDrivers.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Truck #</TableHead>
                    <TableHead>PPD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.map((driver) => (
                    <TableRow key={driver.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {driver.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <Phone className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                          {driver.phone_number || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-100"
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          {driver.solo_or_team || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Truck className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="font-medium">
                            {driver.truck_number || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                          <span>
                            {formatCurrency(driver.subscription_amount)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            driver.status === "active"
                              ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                              : "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                          }
                        >
                          {driver.status === "active" ? (
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                          )}
                          {driver.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(driver.hire_date)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={loading}
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleEditDriver(driver)}
                            >
                              <Pencil className="h-4 w-4 mr-2 text-muted-foreground" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSwapCompany(driver)}
                            >
                              <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                              Swap Company
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(driver)}
                            >
                              {driver.status === "active" ? (
                                <>
                                  <PowerOff className="h-4 w-4 mr-2 text-red-500" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <Power className="h-4 w-4 mr-2 text-green-500" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted/50 p-3 mb-4">
                  <Truck className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No drivers found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery
                    ? `No drivers match "${searchQuery}"`
                    : "This company doesn't have any drivers yet."}
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Add default export to make it compatible with dynamic import
export default CompanyDrivers;
