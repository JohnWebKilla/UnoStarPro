import { useState } from "react";
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

type DriverStatus = "active" | "inactive";

interface CompanyDriver {
  id: string;
  name: string;
  phone_number: string;
  solo_or_team: "SOLO" | "TEAM";
  truck_number: string;
  subscription_amount: number;
  status: DriverStatus;
  company_id: number;
  stripe_product_id?: string;
  hire_date?: string;
  terminated_date?: string;
  created_at: string;
  updated_at: string;
}

interface CompanyDriversProps {
  company: Company;
}

export function CompanyDrivers({ company }: CompanyDriversProps) {
  const [drivers, setDrivers] = useState<CompanyDriver[]>([
    {
      id: "1",
      name: "John Doe",
      phone_number: "555-123-4567",
      solo_or_team: "SOLO",
      truck_number: "101",
      subscription_amount: 250,
      status: "active",
      company_id: company.id,
      stripe_product_id: "prod_123456",
      hire_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "2",
      name: "Jane Smith",
      phone_number: "555-987-6543",
      solo_or_team: "TEAM",
      truck_number: "202",
      subscription_amount: 350,
      status: "active",
      company_id: company.id,
      stripe_product_id: "prod_234567",
      hire_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "3",
      name: "Bob Johnson",
      phone_number: "555-456-7890",
      solo_or_team: "SOLO",
      truck_number: "303",
      subscription_amount: 250,
      status: "inactive",
      company_id: company.id,
      stripe_product_id: "prod_345678",
      hire_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      terminated_date: new Date().toISOString(),
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<CompanyDriver | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("details");

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

  const handleEditDriver = (driver: CompanyDriver) => {
    setEditingDriver(driver);
    form.reset({
      name: driver.name,
      phone_number: driver.phone_number,
      solo_or_team: driver.solo_or_team,
      truck_number: driver.truck_number,
      subscription_amount: driver.subscription_amount,
      status: driver.status,
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

  const handleToggleStatus = (driver: CompanyDriver) => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const newStatus: DriverStatus =
        driver.status === "active" ? "inactive" : "active";
      const updatedDriver: CompanyDriver = {
        ...driver,
        status: newStatus,
        updated_at: new Date().toISOString(),
        terminated_date:
          newStatus === "inactive" ? new Date().toISOString() : undefined,
      };

      setDrivers(drivers.map((d) => (d.id === driver.id ? updatedDriver : d)));

      toast.success(
        `Driver ${driver.name} ${
          newStatus === "active" ? "activated" : "deactivated"
        }`
      );
      setLoading(false);
    }, 1000);
  };

  const filteredDrivers = searchQuery
    ? drivers.filter(
        (driver) =>
          driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          driver.phone_number.includes(searchQuery) ||
          driver.truck_number.toLowerCase().includes(searchQuery.toLowerCase())
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

  const formatCurrency = (amount: number) => {
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
              Manage truck drivers associated with this company
            </p>
          </div>
        </div>
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
          <DialogContent className="max-w-7xl w-[95vw]">
            <DialogHeader>
              <DialogTitle>
                {editingDriver ? "Edit Truck Driver" : "Add New Truck Driver"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="details">Driver Details</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="(xxx)-xxx-xxxx"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="solo_or_team"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Solo / Team</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="SOLO">SOLO</SelectItem>
                                <SelectItem value="TEAM">TEAM</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="truck_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Truck #</FormLabel>
                            <FormControl>
                              <Input placeholder="101" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="subscription_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PPD (weekly)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Enter the weekly price per truck"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Weekly subscription amount per driver
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">
                                    Inactive
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="hire_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hire Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="documents" className="space-y-6">
                    <div className="space-y-6">
                      {/* MVR File Upload */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="mvr_file"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>MVR File</FormLabel>
                              <FormControl>
                                <Input
                                  type="file"
                                  {...field}
                                  value={field.value?.filename}
                                  onChange={(e) =>
                                    field.onChange(e.target.files?.[0])
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="mvr_expiration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>MVR Expiration Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Medical Card Upload */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="medical_card"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Medical Card</FormLabel>
                              <FormControl>
                                <Input
                                  type="file"
                                  {...field}
                                  value={field.value?.filename}
                                  onChange={(e) =>
                                    field.onChange(e.target.files?.[0])
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="medical_card_expiration"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Medical Card Expiration Date
                              </FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Driver License Upload */}
                      <div className="space-y-4 sm:space-y-0">
                        <div className="grid sm:grid-cols-4 gap-4">
                          <div className="sm:col-span-4">
                            <FormField
                              control={form.control}
                              name="license_file"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Driver License</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="file"
                                      {...field}
                                      value={field.value?.filename}
                                      onChange={(e) =>
                                        field.onChange(e.target.files?.[0])
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="license_number"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>License Number</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="license_state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="license_expiration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Expiration Date</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingDriver ? "Update Driver" : "Add Driver"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
            {filteredDrivers.length > 0 ? (
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
                          {driver.phone_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-100"
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          {driver.solo_or_team}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Truck className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="font-medium">
                            {driver.truck_number}
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
                    : "This company doesn't have any truck drivers yet."}
                </p>
                {!searchQuery && (
                  <Button variant="outline" onClick={() => setDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First Driver
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
