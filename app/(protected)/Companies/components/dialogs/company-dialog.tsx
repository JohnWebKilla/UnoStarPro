import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Company } from "../../lib/types";

const formSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  contact_first_name: z.string().min(1, "First name is required"),
  contact_last_name: z.string().min(1, "Last name is required"),
  contact_email: z.string().email("Invalid email address"),
  contact_phone: z.string().min(1, "Phone number is required"),
  subscription_amount: z
    .number()
    .min(0, "Amount must be positive")
    .or(z.string().transform((val) => (val === "" ? 0 : Number(val)))),
});

type FormData = z.infer<typeof formSchema>;

interface CompanyDialogProps {
  company?: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => Promise<void>;
}

export function CompanyDialog({
  company,
  open,
  onOpenChange,
  onSubmit,
}: CompanyDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contact_first_name: "",
      contact_last_name: "",
      contact_email: "",
      contact_phone: "",
      subscription_amount: 0,
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        contact_first_name: company.contact_first_name,
        contact_last_name: company.contact_last_name,
        contact_email: company.contact_email,
        contact_phone: company.contact_phone,
        subscription_amount: company.subscription_amount,
      });
    } else {
      form.reset({
        name: "",
        contact_first_name: "",
        contact_last_name: "",
        contact_email: "",
        contact_phone: "",
        subscription_amount: 0,
      });
    }
  }, [company, form]);

  const handleSubmit = async (data: FormData) => {
    try {
      await onSubmit(data);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error submitting form:", error);
      // Error will be handled by the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{company ? "Edit Company" : "Add Company"}</DialogTitle>
          <DialogDescription>
            {company
              ? "Make changes to the company here."
              : "Add a new company to your organization."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contact email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contact phone" {...field} />
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
                  <FormLabel>Subscription Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter subscription amount"
                      {...field}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {company ? "Save changes" : "Add company"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
