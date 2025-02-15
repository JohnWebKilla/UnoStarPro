"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
import { CompanyManagement } from "./company-management";
import { User, UserRole } from "./types";
import { Building } from "lucide-react";

const formSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone_number: z.string().min(1, "Phone number is required"),
  role: z.string(),
  password: z.string().optional(),
  dob: z.string().optional(),
});

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSuccess?: (user?: User) => void;
  companies: Array<{ id: number; name: string }>;
}

// Helper function to convert a Supabase auth user to our custom User type
function formatUser(supabaseUser: import("@supabase/auth-js").User): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    first_name: supabaseUser.user_metadata?.first_name || "",
    last_name: supabaseUser.user_metadata?.last_name || "",
    phone_number: supabaseUser.user_metadata?.phone_number || "",
    role: supabaseUser.user_metadata?.role || "user",
    status: supabaseUser.user_metadata?.status || "active",
    has_all_access: supabaseUser.user_metadata?.has_all_access || false,
    created_at: supabaseUser.created_at || new Date().toISOString(),
    dob: supabaseUser.user_metadata?.dob || null,
    company_id: supabaseUser.user_metadata?.company_id || null,
    avatar: supabaseUser.user_metadata?.avatar || null,
  };
}

export function UserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
  companies,
}: UserDialogProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [dialogState, setDialogState] = useState({
    isSubmitting: false,
    companyDialogOpen: false,
    shouldReset: false,
  });
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone_number: "",
      role: "user",
      password: "",
      dob: "",
    },
  });

  // Reset form when user changes
  useEffect(() => {
    if (user && open) {
      const formattedDate = user.dob
        ? new Date(user.dob).toISOString().split("T")[0]
        : "";

      form.reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        role: user.role || "user",
        dob: formattedDate,
      });
    }
  }, [user, open, form]);

  // Handle dialog state changes
  useEffect(() => {
    if (!open) {
      if (dialogState.shouldReset) {
        form.reset();
        setDialogState((prev) => ({
          ...prev,
          isSubmitting: false,
          companyDialogOpen: false,
          shouldReset: false,
        }));
        setCreatedUser(null);
      }
    }
  }, [open, form, dialogState.shouldReset]);

  const handleDialogChange = useCallback(
    (newOpen: boolean) => {
      if (dialogState.isSubmitting) return;

      if (!newOpen) {
        setDialogState((prev) => ({ ...prev, shouldReset: true }));
      }
      onOpenChange(newOpen);
    },
    [dialogState.isSubmitting, onOpenChange]
  );

  const handleSubmit = useCallback(
    async (values: z.infer<typeof formSchema>) => {
      if (dialogState.isSubmitting) return;

      try {
        setDialogState((prev) => ({ ...prev, isSubmitting: true }));
        const formData = new FormData();

        Object.entries(values).forEach(([key, value]) => {
          if (value) formData.append(key, value);
        });

        if (user) {
          formData.append("id", user.id);

          // Create optimistic user update
          const optimisticUser: User = {
            ...user,
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone_number: values.phone_number,
            role: values.role as UserRole,
            dob: values.dob,
          };

          // Call onSuccess immediately with optimistic data
          onSuccess?.(optimisticUser);

          // Make the API call in the background
          const response = await updateUser(formData);
          if (response.error) throw new Error(response.error);
          if (!response.user || !response.user.user)
            throw new Error("User update failed");
        } else {
          const response = await createUser(formData);
          if (response.error) throw new Error(response.error);
          if (!response.user || !response.user.user)
            throw new Error("User creation failed");

          const newUser = formatUser(response.user.user);
          setCreatedUser(newUser);
          setDialogState((prev) => ({ ...prev, companyDialogOpen: true }));

          toast({
            title: "Success",
            description:
              "User created successfully. Please configure company access.",
          });
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "An error occurred",
          variant: "destructive",
        });
        // If there was an error, we need to close the dialog and let the parent know
        onOpenChange(false);
      } finally {
        setDialogState((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [user, toast, onSuccess, onOpenChange, dialogState.isSubmitting]
  );

  const handleCompanyDialogChange = useCallback(
    (open: boolean) => {
      if (!dialogState.isSubmitting) {
        setDialogState((prev) => ({ ...prev, companyDialogOpen: open }));
        if (!open) {
          handleDialogChange(false);
          if (createdUser) {
            onSuccess?.(createdUser);
          }
        }
      }
    },
    [dialogState.isSubmitting, handleDialogChange, createdUser, onSuccess]
  );

  const handleCompanyManagementSuccess = useCallback(() => {
    handleDialogChange(false);
    if (createdUser) {
      onSuccess?.(createdUser);
    }
  }, [handleDialogChange, createdUser, onSuccess]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent
          className="sm:max-w-[425px]"
          onEscapeKeyDown={(e) =>
            dialogState.isSubmitting && e.preventDefault()
          }
          onInteractOutside={(e) =>
            dialogState.isSubmitting && e.preventDefault()
          }
          onCloseAutoFocus={(e) =>
            dialogState.isSubmitting && e.preventDefault()
          }
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
              onSubmit={form.handleSubmit(handleSubmit)}
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
                      <Input {...field} type="email" className="rounded-md" />
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
                      <Input {...field} type="tel" className="rounded-md" />
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
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="driver">Driver</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <Input {...field} type="date" className="rounded-md" />
                    </FormControl>
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
                          placeholder="Leave empty for auto-generated password"
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
                  onClick={() => handleDialogChange(false)}
                  disabled={dialogState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={dialogState.isSubmitting}>
                  {user ? "Save Changes" : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {createdUser && (
        <CompanyManagement
          open={dialogState.companyDialogOpen}
          onOpenChange={handleCompanyDialogChange}
          userId={createdUser.id}
          userRole={createdUser.role}
          currentCompanyIds={
            createdUser.company_id ? [createdUser.company_id] : []
          }
          hasAllAccess={createdUser.has_all_access}
          companies={companies}
          userName={`${createdUser.first_name} ${createdUser.last_name}`}
          onSuccess={handleCompanyManagementSuccess}
        />
      )}
    </>
  );
}
