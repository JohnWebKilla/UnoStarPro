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
  defaultUserId?: string | null;
}

export function PayrollDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultUserId,
}: PayrollDialogProps) {
  const { toast } = useToast();
  const supabase = createClient();
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      user_id: defaultUserId || "",
      transaction_type: "payment",
      amount: 0,
      description: "",
      transaction_date: new Date(),
    },
  });

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .eq("status", "active");

    if (error) {
      console.error("Error fetching users:", error);
      return;
    }

    setUsers(
      data.map((user) => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
      }))
    );
  };

  useEffect(() => {
    if (open) {
      fetchUsers();
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

      const amountNumber = parseFloat(amount || "0");

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

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transaction created successfully",
      });

      onSuccess?.();
      onOpenChange(false);
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
    } finally {
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
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
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
                  <FormLabel>Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select transaction type" />
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
                  <div className="grid gap-2">
                    <Input
                      id="amount"
                      type="number"
                      value={amount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAmount(value === "" ? "" : value);
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setAmount("0");
                        }
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
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
                    <MonthPicker
                      selected={field.value}
                      onMonthChange={field.onChange}
                      placeholder="Select date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
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
