import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { PlusCircle, Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDrivers } from "./DriversClientProvider";
import { clearDriverCaches } from "../actions";
import {
  formatPhoneNumber,
  normalizePhoneNumber,
  isValidPhoneNumber,
} from "@/lib/utils/phone-format";
import { ImportDrivers } from "./ImportDrivers";
import { useCompanies } from "@/app/(protected)/Companies/hooks/useCompanies";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SubscriptionFrequency,
  SUBSCRIPTION_FREQUENCY_OPTIONS,
} from "../types";
import { Label } from "@/components/ui/label";

const driverFormSchema = z.object({
  company_id: z.coerce.number({
    required_error: "Please select a company",
    invalid_type_error: "Please select a valid company",
  }),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  phone_number: z
    .string()
    .min(10, "Phone number must be at least 10 characters")
    .max(20, "Phone number cannot exceed 20 characters")
    .refine((val) => isValidPhoneNumber(val), {
      message: "Please enter a valid 10-digit phone number",
    }),
  truck_number: z
    .string()
    .min(1, "Truck number is required")
    .max(20, "Truck number cannot exceed 20 characters"),
  solo_or_team: z.enum(["solo", "team"]),
  subscription_amount: z.preprocess(
    (val) =>
      val === "" || val === null || val === undefined ? 0 : Number(val),
    z.number().min(0, "Weekly price must be a positive number")
  ),
  subscription_frequency: z.enum(["weekly", "monthly"]).default("weekly"),
  status: z.enum(["pending", "active", "inactive"]),
  hire_date: z.string().optional(),
  upload_documents: z.boolean().default(false),
  license_file: z.instanceof(File).optional().nullable(),
  medical_card_file: z.instanceof(File).optional().nullable(),
  mvr_file: z.instanceof(File).optional().nullable(),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

interface AddDriverDialogProps {
  onDriverAdded?: () => Promise<void>;
}

export function AddDriverDialog({ onDriverAdded }: AddDriverDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const { toast } = useToast();
  const { refreshDrivers, temporarilyDisableRealtimeInserts } = useDrivers();
  const { companies } = useCompanies();

  const form = useForm<z.infer<typeof driverFormSchema>>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      company_id: undefined,
      name: "",
      phone_number: "",
      truck_number: "",
      solo_or_team: "solo",
      subscription_amount: 0,
      subscription_frequency: "weekly",
      status: "pending",
      hire_date: new Date().toISOString().split("T")[0],
      upload_documents: false,
      license_file: null,
      medical_card_file: null,
      mvr_file: null,
    },
  });

  const uploadDocuments = form.watch("upload_documents");

  // Format phone number as user types
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPhoneNumber(e.target.value);
    form.setValue("phone_number", formattedValue);
  };

  const onSubmit = async (values: z.infer<typeof driverFormSchema>) => {
    try {
      setIsLoading(true);
      const normalizedPhone = normalizePhoneNumber(values.phone_number);

      // Disable real-time inserts to prevent duplicate drivers
      temporarilyDisableRealtimeInserts();
      console.log(
        "🔒 Disabled real-time inserts before adding driver:",
        values.name
      );

      // Remove form-only fields that don't exist in the database
      const {
        upload_documents,
        license_file,
        medical_card_file,
        mvr_file,
        ...driverData
      } = values;

      // Create FormData if documents are being uploaded
      if (values.upload_documents) {
        const formData = new FormData();

        // Add driver details to FormData
        formData.append(
          "driverData",
          JSON.stringify({
            ...driverData,
            phone_number: normalizedPhone,
          })
        );

        // Add files if they exist
        if (values.license_file) {
          formData.append("license_file", values.license_file);
        }

        if (values.medical_card_file) {
          formData.append("medical_card_file", values.medical_card_file);
        }

        if (values.mvr_file) {
          formData.append("mvr_file", values.mvr_file);
        }

        const response = await fetch("/api/drivers/with-documents", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error response:", errorText);
          throw new Error(`Failed to create driver: ${errorText}`);
        }

        const newDriver = await response.json();
        console.log(
          "✅ New driver with documents created successfully:",
          newDriver
        );
      } else {
        // Regular driver creation without documents
        const response = await fetch("/api/drivers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...driverData,
            phone_number: normalizedPhone,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error response:", errorText);
          throw new Error(`Failed to create driver: ${errorText}`);
        }

        // Get the newly created driver from the response
        const newDriver = await response.json();
        console.log("✅ New driver created successfully:", newDriver);
      }

      // Clear all caches
      await clearDriverCaches();

      // Add a small delay to refresh after real-time event handling is disabled
      // This ensures we only see one copy of the driver in the UI
      setTimeout(async () => {
        await refreshDrivers(true); // Force fresh data

        if (onDriverAdded) {
          await onDriverAdded();
        }

        console.log("📋 Driver list refreshed after creation");
      }, 300);

      toast({
        title: "Success",
        description: "Driver added successfully",
      });

      setOpen(false);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Driver
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Driver</DialogTitle>
        </DialogHeader>
        <Tabs
          defaultValue="manual"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="import">File Import</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="mt-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Company <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const numValue = parseInt(value);
                          field.onChange(numValue);
                          // Set subscription amount when company changes
                          const selectedCompany = companies.find(
                            (c) => c.id === numValue
                          );
                          if (selectedCompany?.subscription_amount) {
                            form.setValue(
                              "subscription_amount",
                              selectedCompany.subscription_amount
                            );
                          }
                        }}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a company" />
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

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Driver's full name"
                          {...field}
                          onChange={(e) => {
                            // Capitalize first letter of each word
                            const words = e.target.value.split(" ");
                            const capitalizedWords = words.map(
                              (word) =>
                                word.charAt(0).toUpperCase() + word.slice(1)
                            );
                            field.onChange(capitalizedWords.join(" "));
                          }}
                        />
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
                      <FormLabel>
                        Phone Number <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(123) 456-7890"
                          {...field}
                          onChange={(e) => handlePhoneInput(e)}
                          maxLength={14} // (XXX) XXX-XXXX
                        />
                      </FormControl>
                      <FormDescription>
                        Enter a 10-digit phone number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="truck_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Truck Number <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter truck number" {...field} />
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
                      <FormLabel>
                        Driver Type <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select driver type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="solo">Solo</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="subscription_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subscription Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              field.onChange(
                                e.target.value === ""
                                  ? 0
                                  : parseFloat(e.target.value)
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subscription_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Billing Frequency</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Status <span className="text-red-500">*</span>
                      </FormLabel>
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
                          <SelectItem value="pending">Pending</SelectItem>
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
                    <FormItem>
                      <FormLabel>Hire Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          defaultValue={new Date().toISOString().split("T")[0]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="upload_documents"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Upload Documents</FormLabel>
                        <FormDescription>
                          Add driver license, medical card, and MVR
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {uploadDocuments && (
                  <div className="space-y-4 p-3 border rounded-md bg-slate-50 dark:bg-slate-900">
                    <h3 className="font-medium">Driver Documents</h3>

                    <FormField
                      control={form.control}
                      name="license_file"
                      render={({
                        field: { value, onChange, ...fieldProps },
                      }) => (
                        <FormItem>
                          <FormLabel>Driver License</FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                onChange(file);
                              }}
                              {...fieldProps}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="medical_card_file"
                      render={({
                        field: { value, onChange, ...fieldProps },
                      }) => (
                        <FormItem>
                          <FormLabel>Medical Card</FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                onChange(file);
                              }}
                              {...fieldProps}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="mvr_file"
                      render={({
                        field: { value, onChange, ...fieldProps },
                      }) => (
                        <FormItem>
                          <FormLabel>MVR File</FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                onChange(file);
                              }}
                              {...fieldProps}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Driver"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="import" className="mt-4">
            <ImportDrivers
              onImportComplete={() => {
                setOpen(false);
                if (onDriverAdded) {
                  onDriverAdded();
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
