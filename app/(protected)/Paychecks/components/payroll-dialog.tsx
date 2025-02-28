"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { startOfMonth } from "date-fns";
import { MonthPicker } from "@/components/ui/month-picker";
import { Label } from "@/components/ui/label";
import { TransactionType, PaymentStatus } from "../types";

const formSchema = z.object({
  user_id: z.string().min(1, "Employee is required"),
  transaction_type: z.enum(["payment", "advance", "penalty", "bonus"]),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  description: z.string().optional(),
  transaction_date: z.date(),
});

type FormValues = z.infer<typeof formSchema>;

interface PayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultUserId?: string;
}

export function PayrollDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultUserId,
}: PayrollDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const { toast } = useToast();
  const supabase = createClient();
  const [amount, setAmount] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user_id: defaultUserId || "",
      transaction_type: "payment",
      amount: 0,
      description: "",
      transaction_date: startOfMonth(new Date()),
    },
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .eq("status", "active")
          .order("first_name");

        if (error) throw error;

        const formattedEmployees = data.map((user) => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
        }));

        setEmployees(formattedEmployees);
      } catch (error) {
        console.error("Error fetching employees:", error);
        toast({
          title: "Error",
          description: "Failed to load employees",
          variant: "destructive",
        });
      }
    };

    if (open) {
      fetchEmployees();
      form.reset({
        user_id: defaultUserId || "",
        transaction_type: "payment",
        amount: 0,
        description: "",
        transaction_date: startOfMonth(new Date()),
      });
      setAmount("");
    }
  }, [open]);

  useEffect(() => {
    if (defaultUserId) {
      form.setValue("user_id", defaultUserId);
    }
  }, [defaultUserId, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user?.id) throw new Error("No authenticated user found");

      // Get employee details for optimistic update
      const selectedEmployee = employees.find((e) => e.id === values.user_id);
      if (!selectedEmployee) throw new Error("Employee not found");

      const amountNumber = parseFloat(amount || "0");

      // Create optimistic transaction
      const optimisticTransaction = {
        id: Date.now(), // Temporary ID
        user_id: values.user_id,
        transaction_type: values.transaction_type as TransactionType,
        amount: amountNumber,
        description: values.description,
        transaction_date: values.transaction_date.toISOString(),
        status: "pending" as PaymentStatus,
        created_by: user.id,
        created_at: new Date().toISOString(),
        first_name: selectedEmployee.name.split(" ")[0],
        last_name: selectedEmployee.name.split(" ").slice(1).join(" "),
        email: selectedEmployee.email,
      };

      // Close dialog immediately with optimistic data
      onOpenChange(false);

      // Notify parent of success with optimistic data
      onSuccess?.();

      // Actually perform the insert in the background
      const { error } = await supabase.from("payroll_transactions").insert({
        user_id: values.user_id,
        transaction_type: values.transaction_type,
        amount: amountNumber,
        description: values.description,
        transaction_date: values.transaction_date.toISOString(),
        status: "pending",
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      if (error) {
        // If there's an error, show it but don't reopen the dialog
        console.error("Create transaction error:", {
          error,
          message: error.message,
          timestamp: new Date().toISOString(),
        });

        toast({
          title: "Error",
          description: "Failed to create transaction in the background",
          variant: "destructive",
        });
      } else {
        // Success toast
        toast({
          title: "Success",
          description: "Transaction created successfully",
        });
      }
    } catch (error) {
      console.error("Create transaction error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      });

      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} ({employee.email})
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
              name="transaction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="advance">Advance</SelectItem>
                      <SelectItem value="penalty">Penalty</SelectItem>
                      <SelectItem value="bonus">Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        field.onChange(parseFloat(e.target.value) || 0);
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transaction_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={
                        field.value
                          ? new Date(field.value).toISOString().split("T")[0]
                          : ""
                      }
                      onChange={(e) => {
                        const date = e.target.value
                          ? new Date(e.target.value)
                          : new Date();
                        field.onChange(date);
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Transaction"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
