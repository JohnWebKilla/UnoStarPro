"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Driver, Document } from "../../types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  ArrowLeft,
  FileText,
  Settings,
  History,
  User,
  Calendar,
  Upload,
  FileUp,
  AlertTriangle,
  AlertCircle,
  Clock,
  File,
  ExternalLink,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  format,
  isBefore,
  addDays,
  parseISO,
  formatDistance,
  differenceInDays,
} from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface DriverDetailProps {
  driver: Driver | null;
  driverId: string;
}

export default function DriverDetail({ driver, driverId }: DriverDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Get tab from URL query param or default to 'details'
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<string>(tabParam || "details");

  // Update active tab when URL query changes
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (
      tabFromUrl &&
      ["details", "documents", "logs", "settings"].includes(tabFromUrl)
    ) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/Drivers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{driver?.name}</h1>
          {driver?.status && <StatusBadge status={driver.status} />}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push(`/Drivers/${driverId}/edit`)}>
            Edit Driver
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        className="w-full"
        onValueChange={(value) => {
          // Update URL when tab changes without full navigation
          const url = new URL(window.location.href);
          url.searchParams.set("tab", value);
          window.history.pushState({}, "", url);
          setActiveTab(value);
        }}
      >
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="details">
            <User className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="mr-2 h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <DriverDetails driver={driver} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 relative">
          <div className="flex flex-col h-[calc(100vh-220px)]">
            <div className="bg-background sticky top-0 z-10 pb-4">
              <DocumentsHeader driver={driver} />
            </div>
            <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
              <DriverDocumentsContent driver={driver} driverId={driverId} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4 mt-4">
          <div className="text-center py-6">
            <History className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Logs tab content</p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <div className="text-center py-6">
            <Settings className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Settings tab content</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DriverDetails({ driver }: { driver: Driver | null }) {
  if (!driver) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Full Name</p>
            <p className="font-medium">{driver.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone Number</p>
            <p className="font-medium">{driver.phone || driver.phone_number}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Company</p>
            <p className="font-medium">{driver.company_name || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hire Date</p>
            <p className="font-medium">
              {driver.hire_date
                ? format(new Date(String(driver.hire_date)), "MMM d, yyyy")
                : "N/A"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Driver Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Truck Number</p>
            <p className="font-medium">
              {driver.truckNumber || driver.truck_number || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="font-medium capitalize">
              {driver.type || driver.solo_or_team || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <div>
              <StatusBadge status={driver.status || ""} />
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Last Updated</p>
            <p className="font-medium">
              {driver.updatedAt || driver.updated_at
                ? format(
                    new Date(String(driver.updatedAt || driver.updated_at)),
                    "MMM d, yyyy"
                  )
                : "N/A"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Create a separate StatusBadge component to avoid duplication
const StatusBadge = ({ status }: { status: string }) => {
  if (!status) return null;

  const variants: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline" | "success";
      label: string;
      className?: string;
    }
  > = {
    active: {
      variant: "success",
      label: "Active",
      className:
        "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border-green-500/20 dark:border-green-500/30",
    },
    inactive: {
      variant: "outline",
      label: "Inactive",
      className:
        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    },
    pending: {
      variant: "secondary",
      label: "Pending",
      className:
        "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30",
    },
    terminated: {
      variant: "destructive",
      label: "Terminated",
      className: "",
    },
  };

  const config = variants[status.toLowerCase()] || {
    variant: "outline",
    label: status,
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };

  return (
    <Badge variant={config.variant as any} className={config.className}>
      {config.label}
    </Badge>
  );
};

// Split documents section into header and content
function DocumentsHeader({ driver }: { driver: Driver | null }) {
  if (!driver) return null;

  // Get all documents from different sources
  const documents = (driver.documents || []) as any[];
  const driverLicenses = (driver.driver_licenses || []) as any[];
  const medicalCards = (driver.medical_cards || []) as any[];
  const mvrFiles = ((driver as any).mvr_files || []) as any[];
  const clearingHouse = ((driver as any).clearing_house || []) as any[];

  // Get count of expired and expiring soon documents
  const today = new Date();
  const allDocs = [
    ...documents,
    ...driverLicenses,
    ...medicalCards,
    ...mvrFiles,
    ...clearingHouse,
  ];

  const expiredDocs = allDocs.filter((doc) => {
    const expiryDate = doc.expiration_date || doc.expiryDate;
    return expiryDate && isBefore(parseISO(expiryDate), today);
  });

  const expiringSoonDocs = allDocs.filter((doc) => {
    const expiryDate = doc.expiration_date || doc.expiryDate;
    return (
      expiryDate &&
      !isBefore(parseISO(expiryDate), today) &&
      isBefore(parseISO(expiryDate), addDays(today, 30))
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Driver Documents</h2>
          <p className="text-muted-foreground">
            Manage all documents related to this driver
          </p>
        </div>
        <Button variant="default" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Document Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-md p-4 flex items-center justify-between bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <span className="font-medium">Total Documents</span>
          </div>
          <span className="text-xl font-bold">{allDocs.length}</span>
        </div>

        <div className="border rounded-md p-4 flex items-center justify-between bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="font-medium">Expired Documents</span>
          </div>
          <span className="text-xl font-bold">{expiredDocs.length}</span>
        </div>

        <div className="border rounded-md p-4 flex items-center justify-between bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="font-medium">Expiring Soon</span>
          </div>
          <span className="text-xl font-bold">{expiringSoonDocs.length}</span>
        </div>
      </div>
    </div>
  );
}

// Content portion of driver documents
function DriverDocumentsContent({
  driver,
  driverId,
}: {
  driver: Driver | null;
  driverId: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  if (!driver) return null;

  // Get all documents from different sources
  const documents = (driver.documents || []) as any[];
  const driverLicenses = (driver.driver_licenses || []) as any[];
  const medicalCards = (driver.medical_cards || []) as any[];
  const mvrFiles = ((driver as any).mvr_files || []) as any[];
  const clearingHouse = ((driver as any).clearing_house || []) as any[];

  const handleUpload = (category: string) => {
    setUploading((prev) => ({ ...prev, [category]: true }));

    // Simulate upload - would be replaced with actual upload logic
    setTimeout(() => {
      setUploading((prev) => ({ ...prev, [category]: false }));
      toast({
        title: "Document uploaded",
        description: `Your ${category} document has been uploaded successfully.`,
      });
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Driver Licenses Section */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-muted/20 border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Driver Licenses</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {driverLicenses.length} documents
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleUpload("license")}
                disabled={uploading["license"]}
              >
                {uploading["license"] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Add Driver License
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div
          className="p-4"
          style={{
            maxHeight: driverLicenses.length > 0 ? "300px" : "auto",
            overflowY: driverLicenses.length > 0 ? "auto" : "hidden",
          }}
        >
          {driverLicenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No driver licenses uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
              {driverLicenses.map((doc, index) => (
                <DocumentCard key={doc.id || index} document={doc} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Medical Cards Section */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-muted/20 border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Medical Cards</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {medicalCards.length} document
                {medicalCards.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleUpload("medical")}
                disabled={uploading["medical"]}
              >
                {uploading["medical"] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Add Medical Card
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div
          className="p-4"
          style={{
            maxHeight: medicalCards.length > 0 ? "300px" : "auto",
            overflowY: medicalCards.length > 0 ? "auto" : "hidden",
          }}
        >
          {medicalCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No medical cards uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
              {medicalCards.map((doc, index) => (
                <DocumentCard key={doc.id || index} document={doc} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MVR Files Section - Always show */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-muted/20 border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">MVR Records</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {mvrFiles.length} document{mvrFiles.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleUpload("mvr")}
                disabled={uploading["mvr"]}
              >
                {uploading["mvr"] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Add MVR Record
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div
          className="p-4"
          style={{
            maxHeight: mvrFiles.length > 0 ? "300px" : "auto",
            overflowY: mvrFiles.length > 0 ? "auto" : "hidden",
          }}
        >
          {mvrFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No MVR records uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
              {mvrFiles.map((doc, index) => (
                <DocumentCard key={doc.id || index} document={doc} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clearing House Section - Always show */}
      <div className="border rounded-md overflow-hidden">
        <div className="bg-muted/20 border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Clearing House Records</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {clearingHouse.length} document
                {clearingHouse.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleUpload("clearingHouse")}
                disabled={uploading["clearingHouse"]}
              >
                {uploading["clearingHouse"] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Add Clearing House Record
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div
          className="p-4"
          style={{
            maxHeight: clearingHouse.length > 0 ? "300px" : "auto",
            overflowY: clearingHouse.length > 0 ? "auto" : "hidden",
          }}
        >
          {clearingHouse.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No clearing house records uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
              {clearingHouse.map((doc, index) => (
                <DocumentCard key={doc.id || index} document={doc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component for displaying a document card
function DocumentCard({ document }: { document: any }) {
  const fileUrl =
    document.file_url ||
    document.url ||
    document.license_file_url ||
    document.mvr_file_url;
  const fileName =
    document.file_name ||
    document.name ||
    `Document-${document.id || Math.random().toString(36).substr(2, 9)}`;
  const expirationDate = document.expiration_date || document.expiryDate;

  // Determine days until expiry
  let expiryText = "";
  let isExpiring = false;
  let isExpired = false;

  if (expirationDate) {
    const today = new Date();
    const expDate = parseISO(expirationDate);
    const daysRemaining = differenceInDays(expDate, today);

    if (daysRemaining < 0) {
      isExpired = true;
      expiryText = `Expired ${Math.abs(daysRemaining)} days ago`;
    } else if (daysRemaining <= 30) {
      isExpiring = true;
      expiryText = `Expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`;
    } else {
      expiryText = `Expires in ${daysRemaining} days`;
    }
  }

  return (
    <div className="border rounded-md p-4 bg-amber-50/50 dark:bg-amber-900/10">
      <div className="flex justify-between">
        <div className="flex gap-3">
          <div className="text-amber-600 dark:text-amber-400 mt-1">
            <File className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium">{fileName}</div>
            {expirationDate && (
              <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {expiryText}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          {fileUrl && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                <a href={fileUrl} download>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
