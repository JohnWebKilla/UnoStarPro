import { useState, useEffect } from "react";
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
import { Pencil, FileText, Loader2, Upload, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileIcon } from "lucide-react";

// Matches the schema in AddDriverDialog
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
  // Document related fields - not required by default
  license_number: z.string().optional(),
  license_state: z.string().optional(),
  license_expiration: z.date().optional(),
  mvr_expiration: z.date().optional(),
  medical_card_expiration: z.date().optional(),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: string;
  company_id: number;
  subscription_amount: number;
  status: string;
  hire_date: string;
  terminated_date: string | null;
  created_at: string;
  updated_at: string;
  stripe_product_id: string | null;
}

interface EditDriverDialogProps {
  driver: Driver;
  onDriverUpdated: () => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Add a component for displaying existing documents
const ExistingDocuments = ({
  documents,
  type,
  onDelete,
  onView,
}: {
  documents: Array<{
    id: number;
    url: string;
    name: string;
    expiration_date: string;
  }>;
  type: string;
  onDelete: (type: string, id: number) => Promise<void>;
  onView: (url: string) => void;
}) => {
  if (documents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground mt-2">
        No documents uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4 border-t pt-4">
      <Label className="font-medium">Existing Documents</Label>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
          >
            <div className="flex flex-col">
              <span className="font-medium text-sm">{doc.name}</span>
              <span className="text-xs text-muted-foreground">
                Expires: {new Date(doc.expiration_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(doc.url)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(type, doc.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export function EditDriverDialog({
  driver,
  onDriverUpdated,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditDriverDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [companies, setCompanies] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const { toast } = useToast();
  const [fileUploads, setFileUploads] = useState({
    license: null as File | null,
    medical_card: null as File | null,
    mvr: null as File | null,
  });
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<Record<string, boolean>>(
    {}
  );
  const [existingDocuments, setExistingDocuments] = useState<{
    driver_licenses: any[];
    medical_cards: any[];
    mvr_files: any[];
  }>({
    driver_licenses: [],
    medical_cards: [],
    mvr_files: [],
  });
  const [uploadProgress, setUploadProgress] = useState({
    license: 0,
    medical: 0,
    mvr: 0,
  });

  // Fetch companies on dialog open
  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoading(true);
      try {
        // Fetch companies via API
        const response = await fetch("/api/companies");

        if (!response.ok) {
          throw new Error("Failed to fetch companies");
        }

        const data = await response.json();
        setCompanies(data || []);
      } catch (error) {
        console.error("Error fetching companies:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load companies",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      fetchCompanies();
    }
  }, [open, toast]);

  // Add initial loading of any existing documents
  useEffect(() => {
    if (open) {
      // Reset upload success state when dialog opens
      setUploadSuccess({});
      // Reset file uploads when dialog opens
      setFileUploads({
        license: null,
        medical_card: null,
        mvr: null,
      });
      // Fetch existing documents
      fetchDriverDocuments();
    }
  }, [open, driver.id]);

  // Format hire_date from ISO string to Date object
  const hireDate = driver.hire_date ? new Date(driver.hire_date) : new Date();

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: driver.name,
      phone_number: driver.phone_number,
      truck_number: driver.truck_number,
      solo_or_team: driver.solo_or_team as "solo" | "team",
      status: driver.status.toLowerCase() as "active" | "inactive",
      subscription_amount: driver.subscription_amount,
      company_id: driver.company_id,
      hire_date: hireDate,
      license_number: "",
      license_state: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: DriverFormValues) => {
    setIsLoading(true);
    try {
      // Prepare the driver data for update
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

      console.log("Updating driver with data:", driverData);

      // Use the API endpoint to update the driver
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(driverData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error updating driver:", result.error);
        toast({
          variant: "destructive",
          title: "Error updating driver",
          description: result.error || "Failed to update driver",
        });
        return;
      }

      // Update success
      toast({
        title: "Success",
        description: "Driver updated successfully",
      });

      setInternalOpen(false);
      await onDriverUpdated();
    } catch (err) {
      console.error("Error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update the fetchDriverDocuments function with better error handling
  const fetchDriverDocuments = async () => {
    try {
      // Use the existing driver API that already fetches the documents
      const response = await fetch(`/api/drivers/${driver.id}`);

      let errorMessage = "Failed to fetch driver documents";

      if (!response.ok) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Keep default error message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }

      const driverData = await response.json();

      // Format the data to match our expected structure
      setExistingDocuments({
        driver_licenses: driverData.driver_licenses || [],
        medical_cards: driverData.medical_cards || [],
        mvr_files: driverData.mvr_records || [],
      });
    } catch (error) {
      console.error("Error fetching driver documents:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch driver documents",
        variant: "destructive",
      });
    }
  };

  // Add a function to handle document deletion
  const handleDeleteDocument = async (type: string, id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully",
      });

      // Refresh driver data and documents
      await onDriverUpdated();
      fetchDriverDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete document",
      });
    }
  };

  // Add handleFileUpload function
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: "license" | "medical" | "mvr"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !driver.id) return;

    // Update the progress state for the specific document type
    setUploadProgress((prev) => ({ ...prev, [docType]: 1 }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("driver_id", driver.id.toString());
      formData.append("type", docType);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      // Set progress to 100% on success
      setUploadProgress((prev) => ({ ...prev, [docType]: 100 }));

      // Fetch updated documents
      fetchDriverDocuments();

      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, [docType]: 0 }));
      }, 2000);

      toast({
        title: "Success",
        description: `${docType} document uploaded successfully`,
      });

      // Update driver data
      if (onDriverUpdated) {
        setTimeout(() => {
          onDriverUpdated();
        }, 500);
      }
    } catch (error) {
      console.error(`Error uploading ${docType} document:`, error);
      setUploadProgress((prev) => ({ ...prev, [docType]: 0 }));
      toast({
        title: "Error",
        description: `Failed to upload ${docType} document`,
        variant: "destructive",
      });
    }
  };

  // Add fetchDriverDocuments to useEffect
  useEffect(() => {
    if (driver && driver.id) {
      fetchDriverDocuments();
    }
  }, [driver]);

  // Add viewDocument function inside the component
  const viewDocument = (url: string) => {
    if (!url) {
      toast({
        title: "Error",
        description: "Document URL not available",
        variant: "destructive",
      });
      return;
    }

    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Driver: {driver.name}</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="details"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Driver Details</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 py-4"
            >
              <TabsContent value="details" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
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
                        <Input placeholder="(xxx)-xxx-xxxx" {...field} />
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
                          <SelectTrigger>
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
                        <Input placeholder="101" {...field} />
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
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        Weekly subscription amount per driver
                      </p>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
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
                            <SelectTrigger>
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
                                  format(field.value, "MM/dd/yyyy")
                                ) : (
                                  <span>Pick a date</span>
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
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                      >
                        <FormControl>
                          <SelectTrigger>
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
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                {/* Add Tabs Component for Documents */}
                <Tabs defaultValue="license" className="mt-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="license">License</TabsTrigger>
                    <TabsTrigger value="medical">Medical Card</TabsTrigger>
                    <TabsTrigger value="mvr">MVR</TabsTrigger>
                  </TabsList>

                  <TabsContent value="license" className="space-y-4 mt-4">
                    {/* Display existing license documents */}
                    {existingDocuments.driver_licenses &&
                      existingDocuments.driver_licenses.length > 0 && (
                        <div className="space-y-2 mb-4">
                          <h3 className="text-sm font-medium">
                            Existing License Documents
                          </h3>
                          <div className="space-y-2">
                            {existingDocuments.driver_licenses.map(
                              (doc, index) => (
                                <div
                                  key={`license-${doc.id || index}`}
                                  className="flex items-center justify-between p-2 border rounded-md bg-muted/20"
                                >
                                  <div className="flex items-center space-x-2">
                                    <FileIcon className="h-4 w-4" />
                                    <span className="text-sm">
                                      {doc.file_name || "License Document"}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">
                                      {doc.status || "Uploaded"}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        viewDocument(doc.url || doc.file_url)
                                      }
                                    >
                                      View
                                    </Button>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    <div className="space-y-2">
                      <Label htmlFor="licenseFile">Upload New License</Label>
                      <Input
                        id="licenseFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, "license")}
                      />
                    </div>
                    {uploadProgress.license > 0 &&
                      uploadProgress.license < 100 && (
                        <Progress
                          value={uploadProgress.license}
                          className="h-2"
                        />
                      )}
                  </TabsContent>

                  <TabsContent value="medical" className="space-y-4 mt-4">
                    {/* Display existing medical card documents */}
                    {existingDocuments.medical_cards &&
                      existingDocuments.medical_cards.length > 0 && (
                        <div className="space-y-2 mb-4">
                          <h3 className="text-sm font-medium">
                            Existing Medical Card Documents
                          </h3>
                          <div className="space-y-2">
                            {existingDocuments.medical_cards.map(
                              (doc, index) => (
                                <div
                                  key={`medical-${doc.id || index}`}
                                  className="flex items-center justify-between p-2 border rounded-md bg-muted/20"
                                >
                                  <div className="flex items-center space-x-2">
                                    <FileIcon className="h-4 w-4" />
                                    <span className="text-sm">
                                      {doc.file_name || "Medical Card Document"}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">
                                      {doc.status || "Uploaded"}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        viewDocument(doc.url || doc.file_url)
                                      }
                                    >
                                      View
                                    </Button>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    <div className="space-y-2">
                      <Label htmlFor="medicalFile">
                        Upload New Medical Card
                      </Label>
                      <Input
                        id="medicalFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, "medical")}
                      />
                    </div>
                    {uploadProgress.medical > 0 &&
                      uploadProgress.medical < 100 && (
                        <Progress
                          value={uploadProgress.medical}
                          className="h-2"
                        />
                      )}
                  </TabsContent>

                  <TabsContent value="mvr" className="space-y-4 mt-4">
                    {/* Display existing MVR documents */}
                    {existingDocuments.mvr_files &&
                      existingDocuments.mvr_files.length > 0 && (
                        <div className="space-y-2 mb-4">
                          <h3 className="text-sm font-medium">
                            Existing MVR Documents
                          </h3>
                          <div className="space-y-2">
                            {existingDocuments.mvr_files.map((doc, index) => (
                              <div
                                key={`mvr-${doc.id || index}`}
                                className="flex items-center justify-between p-2 border rounded-md bg-muted/20"
                              >
                                <div className="flex items-center space-x-2">
                                  <FileIcon className="h-4 w-4" />
                                  <span className="text-sm">
                                    {doc.file_name || "MVR Document"}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">
                                    {doc.status || "Uploaded"}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      viewDocument(doc.url || doc.file_url)
                                    }
                                  >
                                    View
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    <div className="space-y-2">
                      <Label htmlFor="mvrFile">Upload New MVR</Label>
                      <Input
                        id="mvrFile"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, "mvr")}
                      />
                    </div>
                    {uploadProgress.mvr > 0 && uploadProgress.mvr < 100 && (
                      <Progress value={uploadProgress.mvr} className="h-2" />
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <DialogFooter className="pt-6">
                {activeTab === "details" ? (
                  <Button
                    type="button"
                    onClick={() => setActiveTab("documents")}
                  >
                    Next: Documents
                  </Button>
                ) : (
                  <div className="flex w-full justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab("details")}
                    >
                      Back to Details
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Updating..." : "Update Driver"}
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
