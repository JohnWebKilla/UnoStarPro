"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
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
import { createUser, updateUser } from "../../lib/actions/actions";
import { CompanyManagement } from "../features/company-management";
import { User, UserRole } from "../../lib/types/types";
import { Building, PlusCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  first_name: z.string().min(2, "First name must be at least 2 characters"),
  last_name: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone_number: z.string().min(1, "Phone number is required"),
  role: z.string(),
  department: z
    .enum(["Editor", "Manager", "Dispatcher", "Safety"] as const)
    .optional(),
  password: z.string().optional(),
  dob: z.string().optional(),
  working_shift: z.string().optional(),
  off_days: z.array(z.string()).optional(),
});

interface UserDialogProps {
  user?: User;
  onSuccess?: (user?: User) => void;
  companies: Array<{ id: number; name: string }>;
  onUserAdded?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SHIFTS = [
  { id: "1", name: "Shift 1 (08:00 - 16:00)" },
  { id: "2", name: "Shift 2 (16:00 - 00:00)" },
  { id: "3", name: "Shift 3 (00:00 - 08:00)" },
];

const DAYS = [
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
];

const DEPARTMENTS = {
  Editor: { icon: "✏️", label: "Editor" },
  Manager: { icon: "👔", label: "Manager" },
  Dispatcher: { icon: "📡", label: "Dispatcher" },
  Safety: { icon: "🛡️", label: "Safety" },
} as const;

// Helper function to convert a Supabase auth user to our custom User type
function formatUser(supabaseUser: import("@supabase/auth-js").User): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    first_name: supabaseUser.user_metadata?.first_name || "",
    last_name: supabaseUser.user_metadata?.last_name || "",
    phone_number: supabaseUser.user_metadata?.phone_number || "",
    role: supabaseUser.user_metadata?.role || "user",
    department: supabaseUser.user_metadata?.department || undefined,
    status: supabaseUser.user_metadata?.status || "active",
    has_all_access: supabaseUser.user_metadata?.has_all_access || false,
    created_at: supabaseUser.created_at || new Date().toISOString(),
    dob: supabaseUser.user_metadata?.dob || null,
    company_id: supabaseUser.user_metadata?.company_id || null,
    avatar: supabaseUser.user_metadata?.avatar || null,
    working_shift: supabaseUser.user_metadata?.working_shift || "1",
    off_days: supabaseUser.user_metadata?.off_days || ["saturday", "sunday"],
  };
}

interface DialogState {
  isSubmitting: boolean;
  companyDialogOpen: boolean;
  shouldReset: boolean;
}

export function UserDialog({
  user,
  onSuccess,
  companies,
  onUserAdded,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: UserDialogProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({
    isSubmitting: false,
    companyDialogOpen: false,
    shouldReset: false,
  });
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  // Use controlled or uncontrolled open state
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone_number: "",
      role: "user",
      department: undefined,
      password: "",
      dob: "",
      working_shift: "1",
      off_days: ["saturday", "sunday"],
    },
  });

  const handleDialogChange = useCallback(
    (newOpen: boolean) => {
      if (dialogState.isSubmitting) return;

      if (!newOpen) {
        setDialogState((prev: DialogState) => ({ ...prev, shouldReset: true }));
      }
      setOpen(newOpen);
    },
    [dialogState.isSubmitting, setOpen]
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (user && open) {
      const formattedDate = user.dob
        ? new Date(user.dob).toISOString().split("T")[0]
        : "";

      // Ensure we have working_shift and off_days with proper defaults
      const working_shift = user.working_shift || "1";
      const off_days =
        Array.isArray(user.off_days) && user.off_days.length > 0
          ? user.off_days
          : ["saturday", "sunday"];

      form.reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        role: user.role || "user",
        department: user.department,
        dob: formattedDate,
        working_shift: working_shift,
        off_days: off_days,
      });
    } else if (!user && open) {
      form.reset({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        role: "user",
        department: undefined,
        password: "",
        dob: "",
        working_shift: "1",
        off_days: ["saturday", "sunday"],
      });
    }
  }, [user, open, form]);

  // Handle dialog state cleanup
  useEffect(() => {
    if (!open && dialogState.shouldReset) {
      setDialogState((prev: DialogState) => ({
        ...prev,
        isSubmitting: false,
        companyDialogOpen: false,
        shouldReset: false,
      }));
      setCreatedUser(null);
    }
  }, [open, dialogState.shouldReset]);

  const handleSubmit = useCallback(
    async (values: z.infer<typeof formSchema>) => {
      if (dialogState.isSubmitting) return;

      setDialogState((prev) => ({ ...prev, isSubmitting: true }));

      try {
        console.log("Submitting form with values:", values);
        console.log("Working shift:", values.working_shift);
        console.log("Off days:", values.off_days);

        const formData = new FormData();

        // Add all form values
        for (const key in values) {
          const value = values[key as keyof typeof values];
          if (value !== undefined && value !== null) {
            if (key === "off_days" && Array.isArray(value)) {
              // Handle off_days array properly
              value.forEach((day) => {
                formData.append("off_days", day);
              });
            } else {
              formData.append(key, String(value));
            }
          }
        }

        // If editing, add the user ID
        if (user) {
          formData.append("id", user.id);

          // Create an optimistic update of the user object with the new values
          const optimisticUser: User = {
            ...user,
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone_number: values.phone_number,
            role: values.role as UserRole,
            department: values.department,
            dob: values.dob ? values.dob : undefined,
            working_shift: values.working_shift || "1",
            off_days: values.off_days || ["saturday", "sunday"],
          };

          // Close the dialog and notify parent with the optimistic user data
          handleDialogChange(false);
          onSuccess?.(optimisticUser);

          // Update the user in the background
          updateUser(formData)
            .then((result) => {
              if (result.error) {
                console.error("Background user update failed:", result.error);
                toast({
                  title: "Update Error",
                  description: result.error,
                  variant: "destructive",
                });
              } else if (result.user) {
                // Log the updated user data
                console.log("User updated successfully:", result.user);

                // Create an updated user object with the returned data
                const updatedUserData = {
                  ...optimisticUser,
                  working_shift:
                    result.user.user_metadata?.working_shift ||
                    optimisticUser.working_shift,
                  off_days:
                    result.user.user_metadata?.off_days ||
                    optimisticUser.off_days,
                };

                // Update the user in the table silently (without reopening the dialog)
                setTimeout(() => {
                  onSuccess?.(updatedUserData);
                }, 500);
              }
            })
            .catch((error) => {
              console.error("Error updating user:", error);
            });
        } else {
          // Create new user
          const result = await createUser(formData);

          if (result.error) {
            throw new Error(result.error);
          }

          toast({
            title: "User Created",
            description: "New user has been created",
          });

          // For new users, open the company dialog
          setDialogState((prev) => ({ ...prev, companyDialogOpen: true }));
        }
      } catch (error: any) {
        console.error("Error submitting form:", error);
        toast({
          title: "Error",
          description: error.message || "Something went wrong",
          variant: "destructive",
        });
        setDialogState((prev) => ({ ...prev, isSubmitting: false }));
      }
    },
    [user, toast, onSuccess, handleDialogChange, dialogState.isSubmitting]
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

  // Log user data for debugging
  useEffect(() => {
    if (user) {
      console.log("UserDialog received user data:", user);
      console.log("Working shift:", user.working_shift);
      console.log("Off days:", user.off_days);
    }
  }, [user]);

  // Fix the handleSuccess function to handle null case
  const handleSuccess = useCallback(
    (updatedUser?: User) => {
      if (onSuccess) {
        onSuccess(updatedUser);
      }
      if (onUserAdded) {
        onUserAdded();
      }
    },
    [onSuccess, onUserAdded]
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      {/* Only render the trigger if we're creating a new user */}
      {!user && (
        <DialogTrigger asChild>
          <Button className="h-9 relative z-0">
            <PlusCircle className=" mr-2" />
            Add User
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="sm:max-w-[600px] w-[95vw] max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (dialogState.isSubmitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (dialogState.isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Update user information"
              : "Fill in the details to create a new user"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Row 1: First Name and Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
                        {...field}
                        disabled={dialogState.isSubmitting}
                      />
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
                      <Input
                        placeholder="Doe"
                        {...field}
                        disabled={dialogState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: Email and Phone Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john.doe@example.com"
                        {...field}
                        disabled={dialogState.isSubmitting || !!user}
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
                        placeholder="+1 (555) 123-4567"
                        {...field}
                        disabled={dialogState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Role and Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={dialogState.isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
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

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={dialogState.isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(DEPARTMENTS).map(
                          ([key, { icon, label }]) => (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center">
                                <span className="mr-2">{icon}</span>
                                {label}
                              </span>
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 4: Password (only for new users) and Date of Birth */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!user && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={dialogState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={dialogState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5: Working Shift */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="working_shift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Working Shift</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={dialogState.isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SHIFTS.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 6: Off Days */}
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="off_days"
                render={() => (
                  <FormItem>
                    <div className="mb-2">
                      <FormLabel>Off Days</FormLabel>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {DAYS.map((day) => (
                        <FormField
                          key={day.id}
                          control={form.control}
                          name="off_days"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={day.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(day.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([
                                            ...(field.value || []),
                                            day.id,
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== day.id
                                            )
                                          );
                                    }}
                                    disabled={dialogState.isSubmitting}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {day.label}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={dialogState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={dialogState.isSubmitting}>
                {dialogState.isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                    {user ? "Updating..." : "Creating..."}
                  </>
                ) : user ? (
                  "Update User"
                ) : (
                  "Create User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {createdUser && (
        <CompanyManagement
          open={dialogState.companyDialogOpen}
          onOpenChange={(open) => {
            setDialogState((prev) => ({
              ...prev,
              companyDialogOpen: open,
            }));
          }}
          userId={createdUser.id}
          userRole={createdUser.role as UserRole}
          currentCompanyIds={[]}
          hasAllAccess={false}
          companies={companies}
          userName={`${createdUser.first_name} ${createdUser.last_name}`}
          onSuccess={(selectedCompanyIds, isAllAccess) => {
            setDialogState((prev) => ({
              ...prev,
              companyDialogOpen: false,
              shouldReset: true,
            }));
            handleDialogChange(false);
            if (createdUser) {
              handleSuccess(createdUser);
            }
          }}
        />
      )}
    </Dialog>
  );
}
