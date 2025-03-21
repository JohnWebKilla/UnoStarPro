import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Pencil } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Matches the schema in AddDriverDialog
const driverFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  phone_number: z
    .string()
    .min(10, "Phone number must be at least 10 characters")
    .max(20, "Phone number cannot exceed 20 characters"),
  truck_number: z
    .string()
    .min(1, "Truck number is required")
    .max(20, "Truck number cannot exceed 20 characters"),
  solo_or_team: z.enum(["solo", "team"]),
  status: z.enum(["active", "inactive"]),
  subscription_amount: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? 0 : Number(val),
    z.number().min(0, "Subscription amount must be a positive number")
  ),
  company_id: z.coerce.number({
    required_error: "Please select a company",
    invalid_type_error: "Please select a valid company",
  }),
  hire_date: z.date({
    required_error: "Hire date is required",
  }),
  // Document related fields - not required by default
  license_number: z.string().optional(),
  license_state: z.string().optional(),
  license_expiration: z.date().optional(),
  mvr_expiration: z.date().optional(),
  medical_card_expiration: z.date().optional(),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: string;
  company_id: number;
  subscription_amount: number;
  status: string;
  hire_date: string;
  terminated_date: string | null;
  created_at: string;
  updated_at: string;
  stripe_product_id: string | null;
}

interface EditDriverDialogProps {
  driver: Driver;
  onDriverUpdated: () => void;
}

export function EditDriverDialog({
  driver,
  onDriverUpdated,
}: EditDriverDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [companies, setCompanies] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const { toast } = useToast();

  // Fetch companies on dialog open
  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoading(true);
      try {
        // Fetch companies via API
        const response = await fetch("/api/companies");

        if (!response.ok) {
          throw new Error("Failed to fetch companies");
        }

        const data = await response.json();
        setCompanies(data || []);
      } catch (error) {
        console.error("Error fetching companies:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load companies",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      fetchCompanies();
    }
  }, [open, toast]);

  // Format hire_date from ISO string to Date object
  const hireDate = driver.hire_date ? new Date(driver.hire_date) : new Date();

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: driver.name,
      phone_number: driver.phone_number,
      truck_number: driver.truck_number,
      solo_or_team: driver.solo_or_team as "solo" | "team",
      status: driver.status.toLowerCase() as "active" | "inactive",
      subscription_amount: driver.subscription_amount,
      company_id: driver.company_id,
      hire_date: hireDate,
      license_number: "",
      license_state: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: DriverFormValues) => {
    setIsLoading(true);
    try {
      // Prepare the driver data for update
      const driverData = {
        name: data.name.trim(),
        phone_number: data.phone_number.trim(),
        truck_number: data.truck_number.trim(),
        solo_or_team: data.solo_or_team,
        status: data.status.toLowerCase(),
        company_id: data.company_id,
        subscription_amount: Number(data.subscription_amount) || 0,
        hire_date: data.hire_date.toISOString(),
      };

      console.log("Updating driver with data:", driverData);

      // Use the API endpoint to update the driver
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(driverData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error updating driver:", result.error);
        toast({
          variant: "destructive",
          title: "Error updating driver",
          description: result.error || "Failed to update driver",
        });
        return;
      }

      // Update success
      toast({
        title: "Success",
        description: "Driver updated successfully",
      });

      setOpen(false);
      onDriverUpdated();
    } catch (err) {
      console.error("Error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Driver: {driver.name}</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="details"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Driver Details</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-4"
            >
              <TabsContent value="details" className="space-y-4">
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
                        <Input placeholder="(xxx)-xxx-xxxx" {...field} />
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
                          <SelectItem value="solo">SOLO</SelectItem>
                          <SelectItem value="team">TEAM</SelectItem>
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
                          step="0.01"
                          min="0"
                          placeholder="250"
                          onChange={(e) => {
                            const value =
                              e.target.value === ""
                                ? 0
                                : parseFloat(e.target.value);
                            field.onChange(!isNaN(value) ? value : 0);
                          }}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        Weekly subscription amount per driver
                      </p>
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
                            <SelectItem value="inactive">Inactive</SelectItem>
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Hire Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "MM/dd/yyyy")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value, 10))
                        }
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem
                              key={company.id}
                              value={company.id.toString()}
                            >
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                {/* MVR File Section */}
                <div>
                  <Label>MVR File</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full md:w-1/3"
                    >
                      Choose File
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      No file chosen
                    </span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="mvr_expiration"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>MVR Expiration Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MM/dd/yyyy")
                              ) : (
                                <span>mm/dd/yyyy</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Medical Card Section */}
                <div className="pt-2 border-t mt-6">
                  <Label>Medical Card</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full md:w-1/3"
                    >
                      Choose File
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      No file chosen
                    </span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="medical_card_expiration"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Medical Card Expiration Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MM/dd/yyyy")
                              ) : (
                                <span>mm/dd/yyyy</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Driver License Section */}
                <div className="pt-2 border-t mt-6">
                  <Label>Driver License</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full md:w-1/3"
                    >
                      Choose File
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      No file chosen
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <FormField
                  control={form.control}
                  name="license_expiration"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiration Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MM/dd/yyyy")
                              ) : (
                                <span>mm/dd/yyyy</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <DialogFooter className="pt-6">
                {activeTab === "details" ? (
                  <Button
                    type="button"
                    onClick={() => setActiveTab("documents")}
                  >
                    Next: Documents
                  </Button>
                ) : (
                  <div className="flex w-full justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("details")}
                    >
                      Back to Details
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Updating..." : "Update Driver"}
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
