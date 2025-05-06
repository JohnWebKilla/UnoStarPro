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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
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
  status: z.enum(["pending", "active", "inactive"]),
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
  const { refreshDrivers } = useDrivers();
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
      status: "pending",
    },
  });

  const onSubmit = async (values: z.infer<typeof driverFormSchema>) => {
    try {
      setIsLoading(true);
      const normalizedPhone = normalizePhoneNumber(values.phone_number);

      const response = await fetch("/api/drivers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          phone_number: normalizedPhone,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create driver");
      }

      await clearDriverCaches();
      await refreshDrivers();
      if (onDriverAdded) {
        await onDriverAdded();
      }

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
      <DialogContent className="sm:max-w-[600px]">
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
                      <FormLabel>Company</FormLabel>
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
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Driver's full name"
                          {...field}
                          onChange={(e) => {
                            // Capitalize first letter of each word
                            const words = e.target.value.split(" ");
                            const capitalizedWords = words.map(
                              (word) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase()
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
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(555) 555-5555"
                          {...field}
                          onChange={(e) => {
                            const formatted = formatPhoneNumber(e.target.value);
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="truck_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Truck number" {...field} />
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
                      <FormLabel>Driver Type</FormLabel>
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

                <FormField
                  control={form.control}
                  name="subscription_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekly Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isLoading}>
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
          <TabsContent value="import">
            <ImportDrivers />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
