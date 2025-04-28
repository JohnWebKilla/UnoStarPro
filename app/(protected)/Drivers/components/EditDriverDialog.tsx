"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  DialogClose,
  DialogOverlay,
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
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Driver } from "../types";
import { useDrivers } from "./DriversClientProvider";
import { clearDriverCaches } from "../actions";

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
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

interface EditDriverDialogProps {
  driver: Driver;
  onDriverUpdated: () => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditDriverDialog({
  driver,
  onDriverUpdated,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditDriverDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [isLoading, setIsLoading] = useState(false);
  const { companies, refreshDrivers } = useDrivers();
  const { toast } = useToast();
  const [showCalendar, setShowCalendar] = useState(false);

  // Format hire_date from ISO string to Date object
  const hireDate = useMemo(
    () => (driver.hire_date ? new Date(driver.hire_date) : new Date()),
    [driver.hire_date]
  );

  const defaultValues = useMemo(
    () => ({
      name: driver.name,
      phone_number: driver.phone_number,
      truck_number: driver.truck_number,
      solo_or_team: driver.solo_or_team as "solo" | "team",
      status: driver.status.toLowerCase() as "active" | "inactive",
      subscription_amount: driver.subscription_amount,
      company_id: driver.company_id,
      hire_date: hireDate,
    }),
    [driver, hireDate]
  );

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setShowCalendar(false);
      setIsLoading(false);
      if (controlledOnOpenChange) {
        controlledOnOpenChange(false);
      } else {
        setInternalOpen(false);
      }
    } else {
      if (controlledOnOpenChange) {
        controlledOnOpenChange(true);
      } else {
        setInternalOpen(true);
      }
    }
  };

  const onSubmit = async (data: DriverFormValues) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
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

      // Update driver information
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(driverData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update driver");
      }

      // If subscription amount changed or driver has a Stripe product, sync with Stripe
      if (
        driver.subscription_amount !== driverData.subscription_amount ||
        driver.stripe_product_id
      ) {
        const syncResponse = await fetch(`/api/drivers/${driver.id}/sync`, {
          method: "POST",
        });

        if (!syncResponse.ok) {
          throw new Error("Failed to sync changes with Stripe");
        }
      }

      // Clear both client and server caches
      await clearDriverCaches();

      // Refresh the drivers list with fresh data
      await refreshDrivers(true);

      toast({
        title: "Success",
        description: "Driver and Stripe product updated successfully",
      });

      // Close the dialog
      handleOpenChange(false);

      // Call the onDriverUpdated callback
      await onDriverUpdated();
    } catch (error) {
      console.error("Error updating driver:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update driver",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={true}>
      <DialogContent
        className="
        fixed
        left-[50%]
        top-[50%]
        translate-x-[-50%]
        translate-y-[-50%]
        sm:max-w-[700px] 
        max-h-[90vh] 
        w-[95vw]
        overflow-y-auto 
        bg-white
        shadow-lg
        transition-all 
        duration-200 
        data-[state=open]:animate-in 
        data-[state=closed]:animate-out 
        data-[state=closed]:fade-out-0 
        data-[state=open]:fade-in-0 
        data-[state=closed]:zoom-out-95 
        data-[state=open]:zoom-in-95
        border-0
        rounded-lg
      "
      >
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-black/10 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-xl rounded-lg p-4 shadow-lg flex flex-col items-center gap-3">
              <svg
                className="animate-spin h-6 w-6 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-sm font-medium text-gray-900">
                Updating driver...
              </span>
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>Edit Driver: {driver?.name || "Untitled"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 py-6"
          >
            <div className="grid grid-cols-2 gap-6">
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
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger
                          className="
                          transition-colors
                          hover:bg-gray-50
                        "
                        >
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

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input
                        className="
                          transition-colors
                          focus:ring-2 
                          focus:ring-offset-2 
                          focus:ring-blue-500
                          hover:bg-gray-50
                        "
                        placeholder="John Doe"
                        {...field}
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        className="
                          transition-colors
                          focus:ring-2 
                          focus:ring-offset-2 
                          focus:ring-blue-500
                          hover:bg-gray-50
                        "
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
                        <SelectTrigger
                          className="
                          transition-colors
                          hover:bg-gray-50
                        "
                        >
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
                      <Input
                        className="
                          transition-colors
                          focus:ring-2 
                          focus:ring-offset-2 
                          focus:ring-blue-500
                          hover:bg-gray-50
                        "
                        placeholder="101"
                        {...field}
                      />
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
                        className="
                          transition-colors
                          focus:ring-2 
                          focus:ring-offset-2 
                          focus:ring-blue-500
                          hover:bg-gray-50
                        "
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-gray-400">
                      Weekly subscription amount per driver
                    </p>
                  </FormItem>
                )}
              />

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
                        <SelectTrigger
                          className="
                          transition-colors
                          hover:bg-gray-50
                        "
                        >
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
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-gray-500"
                        )}
                        onClick={() => setShowCalendar(!showCalendar)}
                      >
                        {field.value ? (
                          format(field.value, "MM/dd/yyyy")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                      {showCalendar && (
                        <div className="absolute bottom-[100%] z-50 mb-2 rounded-md border-0 bg-white p-0 text-black shadow-md outline-none">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setShowCalendar(false);
                            }}
                            disabled={isLoading}
                            initialFocus={false}
                            className="bg-white text-black"
                          />
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-6 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "min-w-[120px] relative",
                  isLoading && "text-transparent hover:text-transparent"
                )}
              >
                Update Driver
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
