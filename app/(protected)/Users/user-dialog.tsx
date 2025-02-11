"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { useToast } from "@/components/ui/use-toast";
import { createUser, updateUser } from "./actions";

const formSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  phone_number: z.string(),
  role: z.string(),
  password: z.string().optional(),
  dob: z.string().optional(),
});

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
  onSuccess?: (user?: any) => void;
}

export function UserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserDialogProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone_number: "",
      role: "customer",
      password: "",
      dob: "",
    },
  });

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      const formattedDate = user.dob
        ? new Date(user.dob).toISOString().split("T")[0]
        : "";

      form.reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        role: user.role || "customer",
        dob: formattedDate,
      });
    }
  }, [user, form]);

  const cleanupAndClose = useCallback(() => {
    form.reset();
    onOpenChange(false);
  }, [form, onOpenChange]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      if (user) {
        formData.append("id", user.id);
        await updateUser(formData);
      } else {
        await createUser(formData);
      }

      toast({
        title: "Success",
        description: user
          ? "User updated successfully"
          : "User created successfully",
      });

      await onSuccess?.();
      cleanupAndClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          cleanupAndClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => {
          if (form.formState.isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Create User"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Update the user details below."
              : "Fill in the details to create a new user."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="rounded-md" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="rounded-md" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      className="rounded-md"
                      disabled={!!user}
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
                    <Input {...field} className="rounded-md" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dob"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="rounded-md"
                      value={field.value || ""}
                      onChange={(e) => {
                        field.onChange(e.target.value || "");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                    value={field.value || "customer"}
                  >
                    <FormControl>
                      <SelectTrigger className="rounded-md">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!user && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="rounded-md"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={cleanupAndClose}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving..."
                  : user
                    ? "Update"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
