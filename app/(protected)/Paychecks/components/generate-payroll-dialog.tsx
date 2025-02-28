"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/utils/supabase/client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
  differenceInDays,
} from "date-fns";
import { generateCustomPayrollAction } from "../actions/payroll";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  base_salary: number;
  payment_frequency: string;
  role: string;
  department: string | null;
}

interface GeneratePayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const formSchema = z.object({
  payrollType: z.enum(["all", "selected"]),
  users: z.array(z.string()).optional(),
  periodType: z.enum(["month", "custom"]),
  month: z.date(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  roleFilter: z.string().default("all"),
  departmentFilter: z.string().default("all"),
});

export function GeneratePayrollDialog({
  open,
  onOpenChange,
  onSuccess,
}: GeneratePayrollDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { toast } = useToast();
  const supabase = createClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      payrollType: "all",
      periodType: "month",
      month: new Date(),
      roleFilter: "all",
      departmentFilter: "all",
    },
  });

  const payrollType = form.watch("payrollType");
  const periodType = form.watch("periodType");
  const month = form.watch("month");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const roleFilter = form.watch("roleFilter");
  const departmentFilter = form.watch("departmentFilter");

  // Calculate working days (excluding weekends)
  const calculateWorkingDays = (start: Date, end: Date) => {
    const days = eachDayOfInterval({ start, end });
    return days.filter((day) => !isWeekend(day)).length;
  };

  // Calculate daily rate based on monthly salary
  const calculateDailyRate = (monthlySalary: number) => {
    const currentMonth = month || new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const workingDaysInMonth = calculateWorkingDays(monthStart, monthEnd);
    return monthlySalary / workingDaysInMonth;
  };

  // Calculate prorated salary
  const calculateProratedSalary = (user: User) => {
    if (!startDate || !endDate) return user.base_salary;

    if (periodType === "month") {
      return user.base_salary;
    }

    const dailyRate = calculateDailyRate(user.base_salary);
    const workingDays = calculateWorkingDays(startDate, endDate);
    return dailyRate * workingDays;
  };

  // Add state for available roles and departments
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>(
    []
  );

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log("Fetching users for payroll generation...");

        // First, check if we have a valid Supabase client
        if (!supabase) {
          console.error("No Supabase client available");
          return;
        }

        // Fetch all active users regardless of whether they have payroll in the selected month
        const { data, error } = await supabase
          .from("users")
          .select(
            "id, first_name, last_name, email, base_salary, payment_frequency, role, department"
          )
          .eq("status", "active")
          .order("first_name");

        if (error) {
          console.error("Error fetching users:", error);
          throw error;
        }

        console.log(`Fetched ${data.length} active users`);

        // Extract unique roles and departments
        const roles = Array.from(
          new Set(data.map((user) => user.role).filter(Boolean))
        );
        const departments = Array.from(
          new Set(data.map((user) => user.department).filter(Boolean))
        );

        console.log("Available roles:", roles);
        console.log("Available departments:", departments);

        setAvailableRoles(roles);
        setAvailableDepartments(departments);

        // Filter users with base_salary
        const usersWithSalary = data.filter((user) => {
          const hasSalary = user.base_salary && user.base_salary > 0;
          if (!hasSalary) {
            console.log(
              `User ${user.first_name} ${user.last_name} has no base salary`
            );
          }
          return hasSalary;
        });

        console.log(`Found ${usersWithSalary.length} users with base salary`);

        // Log the first few users for debugging
        if (usersWithSalary.length > 0) {
          console.log("Sample users with salary:", usersWithSalary.slice(0, 2));
        } else {
          console.log(
            "No users with salary found. Raw user data:",
            data.slice(0, 5)
          );
        }

        setUsers(usersWithSalary);
      } catch (error) {
        console.error("Error fetching users:", error);
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive",
        });
      }
    };

    if (open) {
      fetchUsers();
      form.reset({
        payrollType: "all",
        periodType: "month",
        month: new Date(),
        roleFilter: "all",
        departmentFilter: "all",
      });
      setSelectedUsers([]);
    }
  }, [open, form, toast, supabase]);

  // Update the filteredUsers logic to be more lenient and add logging
  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesDepartment =
      departmentFilter === "all" ||
      (user.department && user.department === departmentFilter);

    return matchesRole && matchesDepartment;
  });

  // Add logging for filtered users
  useEffect(() => {
    console.log(
      `Filtered users: ${filteredUsers.length} of ${users.length} total`
    );
    console.log(
      "Current filters - Role:",
      roleFilter,
      "Department:",
      departmentFilter
    );
  }, [filteredUsers.length, users.length, roleFilter, departmentFilter]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      console.log("Submitting payroll generation form with values:", values);

      // Determine which users to process
      const userIds =
        values.payrollType === "all"
          ? filteredUsers.map((user) => user.id)
          : selectedUsers;

      console.log(`Selected ${userIds.length} users for payroll generation`);

      if (userIds.length === 0) {
        console.error("No users selected for payroll generation");
        throw new Error("No users selected for payroll generation");
      }

      // Determine date range
      let periodStart: Date, periodEnd: Date;

      if (values.periodType === "month") {
        periodStart = startOfMonth(values.month);
        periodEnd = endOfMonth(values.month);
        console.log(
          `Using full month: ${format(periodStart, "yyyy-MM-dd")} to ${format(periodEnd, "yyyy-MM-dd")}`
        );
      } else {
        if (!values.startDate || !values.endDate) {
          console.error("Missing start or end date for custom period");
          throw new Error("Please select both start and end dates");
        }
        periodStart = values.startDate;
        periodEnd = values.endDate;
        console.log(
          `Using custom period: ${format(periodStart, "yyyy-MM-dd")} to ${format(periodEnd, "yyyy-MM-dd")}`
        );
      }

      // Log the payload we're about to send
      console.log("Generating payroll with payload:", {
        userIds,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        isFullMonth: values.periodType === "month",
      });

      // Generate payroll for each user
      const result = await generateCustomPayrollAction({
        userIds,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        isFullMonth: values.periodType === "month",
      });

      console.log("Payroll generation result:", result);

      if (!result.success) {
        console.error("Payroll generation failed:", result.error);
        throw new Error(result.error || "Failed to generate payroll");
      }

      toast({
        title: "Success",
        description: `Payroll generated for ${result.count} employees`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error generating payroll:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate payroll",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Generate Payroll</DialogTitle>
          <DialogDescription>
            Generate payroll transactions for employees based on their base
            salary.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Payroll Type Selection */}
            <FormField
              control={form.control}
              name="payrollType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Generate payroll for:</FormLabel>
                  <FormControl>
                    <div className="flex flex-col space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="all"
                          checked={field.value === "all"}
                          onChange={() => field.onChange("all")}
                          className="h-4 w-4"
                        />
                        <span>All employees with base salary</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="selected"
                          checked={field.value === "selected"}
                          onChange={() => field.onChange("selected")}
                          className="h-4 w-4"
                        />
                        <span>Selected employees</span>
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* User Selection */}
            {payrollType === "selected" && (
              <div className="border rounded-md p-4 max-h-[200px] overflow-y-auto">
                <div className="space-y-2">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                        <label
                          htmlFor={`user-${user.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex justify-between w-full"
                        >
                          <div className="flex flex-col">
                            <span>
                              {user.first_name} {user.last_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user.role || "No role"}
                              {user.department ? ` • ${user.department}` : ""}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            ${user.base_salary?.toFixed(2) || "0.00"}/month
                          </span>
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <p>No employees matching the selected filters</p>
                      {users.length > 0 ? (
                        <p className="text-xs mt-2">
                          Try changing the role or department filters. Total
                          users with salary: {users.length}
                        </p>
                      ) : (
                        <p className="text-xs mt-2">
                          No users with base salary found in the system. Please
                          set base salary for employees first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Period Type Selection */}
            <FormField
              control={form.control}
              name="periodType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Payment period:</FormLabel>
                  <FormControl>
                    <div className="flex flex-col space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="month"
                          checked={field.value === "month"}
                          onChange={() => field.onChange("month")}
                          className="h-4 w-4"
                        />
                        <span>Full month</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          value="custom"
                          checked={field.value === "custom"}
                          onChange={() => field.onChange("custom")}
                          className="h-4 w-4"
                        />
                        <span>Custom date range (prorated)</span>
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Month Selection */}
            {periodType === "month" && (
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Month</FormLabel>
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
                              format(field.value, "MMMM yyyy")
                            ) : (
                              <span>Select month</span>
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
                          disabled={(date) => date > new Date()}
                          captionLayout="dropdown-buttons"
                          fromYear={2020}
                          toYear={2030}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Custom Date Range */}
            {periodType === "custom" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Start Date</FormLabel>
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
                                format(field.value, "PPP")
                              ) : (
                                <span>Select date</span>
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
                            disabled={(date) => date > new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>End Date</FormLabel>
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
                                format(field.value, "PPP")
                              ) : (
                                <span>Select date</span>
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
                            disabled={(date) =>
                              date > new Date() ||
                              (startDate ? date < startDate : false)
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Role and Department Filters */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <FormField
                control={form.control}
                name="roleFilter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filter by Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {availableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
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
                name="departmentFilter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filter by Department</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        <SelectItem value="Safety">Safety</SelectItem>
                        <SelectItem value="Editor">Editor</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Dispatcher">Dispatcher</SelectItem>
                        {availableDepartments
                          .filter(
                            (dept) =>
                              ![
                                "Safety",
                                "Editor",
                                "Manager",
                                "Dispatcher",
                              ].includes(dept)
                          )
                          .map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Preview Section */}
            {((payrollType === "selected" && selectedUsers.length > 0) ||
              payrollType === "all") && (
              <div className="border rounded-md p-4">
                <h3 className="font-medium mb-2">Payroll Preview</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {(payrollType === "all"
                    ? filteredUsers
                    : filteredUsers.filter((u) => selectedUsers.includes(u.id))
                  ).length > 0 ? (
                    (payrollType === "all"
                      ? filteredUsers
                      : filteredUsers.filter((u) =>
                          selectedUsers.includes(u.id)
                        )
                    ).map((user) => {
                      const amount = calculateProratedSalary(user);
                      return (
                        <div
                          key={user.id}
                          className="flex justify-between text-sm"
                        >
                          <div className="flex flex-col">
                            <span>
                              {user.first_name} {user.last_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user.role || "No role"}
                              {user.department ? ` • ${user.department}` : ""}
                            </span>
                          </div>
                          <span className="font-medium">
                            ${amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted-foreground py-2">
                      <p>No employees to display in preview</p>
                      <p className="text-xs mt-1">
                        {payrollType === "all"
                          ? "Try changing the role or department filters"
                          : "Please select at least one employee"}
                      </p>
                    </div>
                  )}
                </div>
                {(payrollType === "all"
                  ? filteredUsers
                  : filteredUsers.filter((u) => selectedUsers.includes(u.id))
                ).length > 0 && (
                  <div className="mt-4 pt-2 border-t flex justify-between font-medium">
                    <span>Total:</span>
                    <span>
                      $
                      {(payrollType === "all"
                        ? filteredUsers
                        : filteredUsers.filter((u) =>
                            selectedUsers.includes(u.id)
                          )
                      )
                        .reduce(
                          (sum, user) => sum + calculateProratedSalary(user),
                          0
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Payroll"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
