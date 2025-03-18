import { useState } from "react";
import { Company } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Building2, Mail, Phone, MapPin, User } from "lucide-react";

interface CompanyEditFormProps {
  company: Company;
  onUpdate: (data: Partial<Company>) => Promise<void>;
  onCancel: () => void;
  isUpdating: boolean;
}

export function CompanyEditForm({
  company,
  onUpdate,
  onCancel,
  isUpdating,
}: CompanyEditFormProps) {
  const [formState, setFormState] = useState({
    name: company.name || "",
    contact_first_name: company.contact_first_name || "",
    contact_last_name: company.contact_last_name || "",
    contact_email: company.contact_email || "",
    contact_phone: company.contact_phone || "",
    street: company.street || "",
    city: company.city || "",
    state: company.state || "",
    zip: company.zip || "",
    notifications_enabled: company.notifications_enabled,
    auto_invoice: company.auto_invoice,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdate(formState);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            Edit your company details and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                name="name"
                value={formState.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="mr-2 h-5 w-5" />
            Contact Information
          </CardTitle>
          <CardDescription>Edit contact person details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact_first_name">First Name</Label>
              <Input
                id="contact_first_name"
                name="contact_first_name"
                value={formState.contact_first_name}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_last_name">Last Name</Label>
              <Input
                id="contact_last_name"
                name="contact_last_name"
                value={formState.contact_last_name}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact_email" className="flex items-center">
                <Mail className="mr-1 h-3.5 w-3.5" />
                Email
              </Label>
              <Input
                id="contact_email"
                name="contact_email"
                type="email"
                value={formState.contact_email}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_phone" className="flex items-center">
                <Phone className="mr-1 h-3.5 w-3.5" />
                Phone
              </Label>
              <Input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                value={formState.contact_phone}
                onChange={handleChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="mr-2 h-5 w-5" />
            Address
          </CardTitle>
          <CardDescription>Add or update company address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                name="street"
                value={formState.street}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                value={formState.city}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                value={formState.state}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                name="zip"
                value={formState.zip}
                onChange={handleChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Configure company preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications_enabled">Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications about important updates
              </p>
            </div>
            <Switch
              id="notifications_enabled"
              name="notifications_enabled"
              checked={formState.notifications_enabled}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({
                  ...prev,
                  notifications_enabled: checked,
                }))
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_invoice">Auto Invoice</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate invoices at billing periods
              </p>
            </div>
            <Switch
              id="auto_invoice"
              name="auto_invoice"
              checked={formState.auto_invoice}
              onCheckedChange={(checked) =>
                setFormState((prev) => ({ ...prev, auto_invoice: checked }))
              }
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
