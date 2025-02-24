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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";

const formSchema = z.object({
  category_id: z.string().min(1, "Please select a category"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      "Amount must be greater than 0"
    ),
  currency: z.enum(["USD", "UZS"]),
  amount_uzs: z.number().optional(),
  exchange_rate: z.number().optional(),
  description: z.string().optional(),
  expense_date: z.date({
    required_error: "Please select a date",
    invalid_type_error: "Invalid date",
  }),
  payment_status: z.enum(["pending", "paid", "cancelled"], {
    required_error: "Please select a status",
  }),
  payment_method: z.string().min(1, "Payment method is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface Category {
  id: number;
  name: string;
  description: string | null;
}

interface Expense {
  id: number;
  category_id: number;
  amount: number;
  currency: "USD" | "UZS";
  amount_uzs: number | null;
  exchange_rate: number | null;
  description: string | null;
  expense_date: string;
  payment_status: "pending" | "paid" | "cancelled";
  payment_method: string | null;
}

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  expense?: Expense;
  mode?: "create" | "edit";
}

const formatNumber = (value: string) => {
  // Remove any non-digit characters except decimal point
  const number = value.replace(/[^\d.]/g, "");

  // Split into integer and decimal parts
  const [integer, decimal] = number.split(".");

  // Add thousand separators to integer part
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Return formatted number with decimal if it exists
  return decimal !== undefined
    ? `${formattedInteger}.${decimal}`
    : formattedInteger;
};

export function ExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
  expense,
  mode = "create",
}: ExpenseDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [lastFetchedDate, setLastFetchedDate] = useState<Date | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category_id: "",
      amount: "",
      currency: "USD",
      amount_uzs: undefined,
      exchange_rate: undefined,
      description: "",
      payment_status: "pending",
      payment_method: "",
      expense_date: new Date(),
    },
  });

  const fetchExchangeRate = async (date: Date) => {
    setIsLoadingRate(true);
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await fetch(
        `https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/${formattedDate}/`
      );
      const data = await response.json();
      if (data && data[0]) {
        setExchangeRate(parseFloat(data[0].Rate));
        setLastFetchedDate(date);
        return parseFloat(data[0].Rate);
      }
      return null;
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
      return null;
    } finally {
      setIsLoadingRate(false);
    }
  };

  const currency = form.watch("currency");
  const amount = form.watch("amount");

  useEffect(() => {
    const updateAmounts = async () => {
      if (!amount || !currency || !exchangeRate) return;

      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) return;

      form.setValue("exchange_rate", exchangeRate, { shouldValidate: false });

      if (currency === "USD") {
        form.setValue("amount_uzs", numericAmount * exchangeRate, {
          shouldValidate: false,
        });
      } else {
        form.setValue("amount_uzs", numericAmount, { shouldValidate: false });
      }
    };

    updateAmounts();
  }, [currency, amount, exchangeRate, form]);

  useEffect(() => {
    if (!exchangeRate || !amount) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return;

    if (currency === "UZS") {
      const usdAmount = (numericAmount / exchangeRate).toFixed(2);
      if (usdAmount !== amount) {
        form.setValue("amount", usdAmount, { shouldValidate: false });
      }
    }
  }, [currency]);

  useEffect(() => {
    const expenseDate = form.getValues("expense_date");
    if (expenseDate && (!exchangeRate || expenseDate !== lastFetchedDate)) {
      fetchExchangeRate(expenseDate);
    }
  }, [form.getValues("expense_date")]);

  useEffect(() => {
    if (mode === "edit" && expense) {
      // When editing, show the original amount in the original currency
      const displayAmount =
        expense.currency === "UZS"
          ? expense.amount_uzs?.toString() || "0"
          : expense.amount.toString();

      form.reset({
        category_id: expense.category_id.toString(),
        amount: displayAmount,
        currency: expense.currency,
        amount_uzs: expense.amount_uzs || undefined,
        exchange_rate: expense.exchange_rate || undefined,
        description: expense.description || "",
        expense_date: new Date(expense.expense_date),
        payment_status: expense.payment_status,
        payment_method: expense.payment_method || "",
      });

      // If it's UZS, set the exchange rate
      if (expense.currency === "UZS" && expense.exchange_rate) {
        setExchangeRate(expense.exchange_rate);
      } else if (expense.expense_date) {
        // Fetch current rate if not available
        fetchExchangeRate(new Date(expense.expense_date));
      }
    }
  }, [expense, mode, form]);

  useEffect(() => {
    if (!open) {
      form.reset();
      setNewCategory({ name: "", description: "" });
      setShowNewCategory(false);
    }
  }, [open, form]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }

    setCategories(data);
  };

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const createCategory = async () => {
    try {
      if (!newCategory.name.trim()) {
        toast({
          title: "Error",
          description: "Category name is required",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("expense_categories")
        .insert({
          name: newCategory.name.trim(),
          description: newCategory.description.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories((prev) => [...prev, data]);
      form.setValue("category_id", data.id.toString());
      setNewCategory({ name: "", description: "" });
      setShowNewCategory(false);

      toast({
        title: "Success",
        description: "Category created successfully",
      });
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("No user found");

      // Get the current exchange rate if not already set
      let currentExchangeRate: number | undefined = values.exchange_rate;
      if (!currentExchangeRate && exchangeRate) {
        currentExchangeRate = exchangeRate;
      }

      if (!currentExchangeRate && values.currency === "UZS") {
        throw new Error("Exchange rate is required for UZS transactions");
      }

      // Calculate amounts based on currency
      const numericAmount = parseFloat(values.amount);
      const amountInUSD =
        values.currency === "UZS"
          ? numericAmount / (currentExchangeRate || 1)
          : numericAmount;

      const amountInUZS =
        values.currency === "UZS"
          ? numericAmount
          : numericAmount * (currentExchangeRate || 1);

      // Prepare the expense data
      const expenseData = {
        category_id: parseInt(values.category_id),
        amount: amountInUSD, // Always store USD amount in amount field
        currency: values.currency,
        amount_uzs: values.currency === "UZS" ? amountInUZS : undefined,
        exchange_rate:
          values.currency === "UZS" ? currentExchangeRate : undefined,
        description: values.description,
        expense_date: values.expense_date,
        payment_status: values.payment_status,
        payment_method: values.payment_method,
      };

      if (mode === "edit" && expense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            ...expenseData,
            updated_by: user.id,
          })
          .eq("id", expense.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Expense updated successfully",
        });
      } else {
        const { error } = await supabase.from("expenses").insert({
          ...expenseData,
          created_by: user.id,
          updated_by: user.id,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Expense created successfully",
        });
      }

      onSuccess?.();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error(
        `Error ${mode === "edit" ? "updating" : "creating"} expense:`,
        error
      );
      toast({
        title: "Error",
        description: `Failed to ${mode === "edit" ? "update" : "create"} expense`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "edit" ? "Edit" : "Add New"} Expense
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Category</FormLabel>
                    <div className="space-y-2">
                      {!showNewCategory ? (
                        <div className="flex gap-2">
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem
                                  key={category.id}
                                  value={category.id.toString()}
                                >
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowNewCategory(true)}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            New
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Input
                            placeholder="Category name"
                            value={newCategory.name}
                            onChange={(e) =>
                              setNewCategory((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                          />
                          <Textarea
                            placeholder="Category description (optional)"
                            value={newCategory.description}
                            onChange={(e) =>
                              setNewCategory((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={createCategory}
                              disabled={!newCategory.name.trim()}
                            >
                              Create Category
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setShowNewCategory(false);
                                setNewCategory({ name: "", description: "" });
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="UZS">UZS</SelectItem>
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
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={field.value ? formatNumber(field.value) : ""}
                          onChange={(e) => {
                            // Remove commas for the actual value
                            const rawValue = e.target.value.replace(/,/g, "");
                            // Validate if it's a valid number
                            if (
                              !isNaN(parseFloat(rawValue)) ||
                              rawValue === "" ||
                              rawValue === "."
                            ) {
                              field.onChange(rawValue);
                            }
                          }}
                        />
                        {isLoadingRate && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            Loading rate...
                          </span>
                        )}
                      </div>
                    </FormControl>
                    {exchangeRate && amount && (
                      <p className="text-sm text-muted-foreground">
                        ≈{" "}
                        {currency === "USD"
                          ? `${new Intl.NumberFormat("uz-UZ", { style: "currency", currency: "UZS" }).format(parseFloat(amount) * exchangeRate)}`
                          : `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parseFloat(amount) / exchangeRate)}`}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expense_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col relative">
                    <FormLabel>Date</FormLabel>
                    <Popover
                      open={isPopoverOpen}
                      onOpenChange={setIsPopoverOpen}
                      modal={true}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 relative z-[9999]"
                        align="start"
                        side="bottom"
                        sideOffset={4}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            if (date) {
                              fetchExchangeRate(date);
                              setIsPopoverOpen(false);
                            }
                          }}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          className="rounded-md border"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
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
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Cash, Card, Transfer"
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
                  <FormItem className="col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter expense description"
                        className="resize-none"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {isSubmitting
                  ? mode === "edit"
                    ? "Updating..."
                    : "Creating..."
                  : mode === "edit"
                    ? "Update"
                    : "Create"}{" "}
                Expense
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
