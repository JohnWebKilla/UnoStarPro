"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  AlertTriangle,
  MoreVertical,
  Search,
  Filter,
  Pencil,
  Trash,
  Upload,
  Phone,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditDriverDialog } from "./EditDriverDialog";
import { DeleteDriverDialog } from "./DeleteDriverDialog";
import { useDrivers } from "../hooks/useDrivers";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  format,
  differenceInDays,
  parseISO,
  endOfDay,
  startOfDay,
} from "date-fns";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/use-toast";
import { Driver } from "../types";
import { createClient } from "@/utils/supabase/client";
import { UploadDocumentDialog } from "./UploadDocumentDialog";

// Dynamically import Dialog components with no SSR
const Dialog = dynamic(
  () => import("@/components/ui/dialog").then((mod) => mod.Dialog),
  { ssr: false }
);
const DialogContent = dynamic(
  () => import("@/components/ui/dialog").then((mod) => mod.DialogContent),
  { ssr: false }
);
const DialogHeader = dynamic(
  () => import("@/components/ui/dialog").then((mod) => mod.DialogHeader),
  { ssr: false }
);
const DialogFooter = dynamic(
  () => import("@/components/ui/dialog").then((mod) => mod.DialogFooter),
  { ssr: false }
);
const DialogTitle = dynamic(
  () => import("@/components/ui/dialog").then((mod) => mod.DialogTitle),
  { ssr: false }
);
const DialogDescription = dynamic(
  () => import("@/components/ui/dialog").then((mod) => mod.DialogDescription),
  { ssr: false }
);

interface Document {
  id: number;
  driver_id: number;
  expiration_date: string;
  license_file_url?: string;
  file_link?: string;
  mvr_file_url?: string;
  created_at: string;
  updated_at: string;
  status?: string;
  file_name?: string;
  file_url?: string;
  url?: string;
}

interface DocumentWithType extends Document {
  type: "license" | "medical" | "mvr";
  name: string;
}

export default function DriversTable() {
  const { drivers, error, refreshDrivers } = useDrivers();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const driversPerPage = 5;
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [viewingDocuments, setViewingDocuments] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState<{
    driver: Driver;
    type: "license" | "medical_card" | "mvr";
  } | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<{
    id: number;
    type: "license" | "medical_card" | "mvr";
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingRows, setLoadingRows] = useState<Record<number, boolean>>({});
  const supabase = createClient();

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("drivers_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drivers",
        },
        async (payload) => {
          const metadata = payload.new as { webhook_update?: boolean };
          if (!metadata?.webhook_update) {
            await refreshDrivers();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshDrivers, supabase]);

  const getExpiringDocuments = (driver: Driver): DocumentWithType[] => {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringDocs: DocumentWithType[] = [];

    const checkAndAddDocs = (
      docs: Document[] | undefined,
      type: "license" | "medical" | "mvr",
      name: string
    ) => {
      if (!docs) return;

      docs.forEach((doc) => {
        const expDate = parseISO(doc.expiration_date);
        const currentDate = new Date();
        const daysLeft =
          Math.floor(
            differenceInDays(endOfDay(expDate), startOfDay(currentDate))
          ) + 1;

        if (daysLeft <= 7 && daysLeft >= 0) {
          expiringDocs.push({
            ...doc,
            type,
            name,
          });
        }
      });
    };

    checkAndAddDocs(driver.driver_licenses, "license", "Driver License");
    checkAndAddDocs(driver.medical_cards, "medical", "Medical Card");
    checkAndAddDocs(driver.mvr_files, "mvr", "MVR File");

    return expiringDocs;
  };

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.phone_number.includes(searchTerm) ||
      driver.truck_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && driver.status === "Active") ||
      (statusFilter === "inactive" && driver.status !== "Active");

    return matchesSearch && matchesStatus;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredDrivers.length / driversPerPage);
  const startIndex = (currentPage - 1) * driversPerPage;
  const paginatedDrivers = filteredDrivers.slice(
    startIndex,
    startIndex + driversPerPage
  );

  const updateDriverDocuments = async () => {
    // First refresh the drivers data
    await refreshDrivers();

    // Then update the viewing documents if needed
    if (viewingDocuments) {
      const refreshedDriver = drivers.find((d) => d.id === viewingDocuments.id);
      if (refreshedDriver) {
        // Create a deep copy of the driver to ensure all references are broken
        const freshCopy = JSON.parse(JSON.stringify(refreshedDriver));
        // Update the viewingDocuments state with the fresh copy
        setViewingDocuments(freshCopy);
        // Also increment dialogKey to force React to create a new component instance
        setDialogKey((prev) => prev + 1);
      }
    }
  };

  const handleDocumentUploaded = async () => {
    // First close the upload dialog
    setUploadingDocument(null);

    // Close the viewing documents dialog
    setViewingDocuments(null);

    // Then completely refresh the drivers data
    await refreshDrivers();

    // Show a toast indicating the user needs to reopen the dialog to see changes
    toast({
      title: "Document uploaded",
      description:
        "Document has been uploaded successfully. Reopen to view updates.",
    });
  };

  const handleDriverDeleted = async () => {
    await refreshDrivers();
  };

  const handleSyncAllStripe = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch("/api/drivers/sync", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to sync with Stripe");
      }

      await refreshDrivers();

      // Show success toast with details
      toast({
        title: "Sync Complete",
        description: (
          <div className="flex flex-col gap-2">
            <p>{result.message}</p>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold text-destructive">Errors:</p>
                <ul className="list-disc pl-4">
                  {result.errors.map((error: string, index: number) => (
                    <li key={index} className="text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ),
        duration: result.errors.length > 0 ? 10000 : 5000, // Show longer if there are errors
      });
    } catch (error) {
      console.error("Error syncing all drivers with Stripe:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to sync with Stripe",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncStripe = async (driver: Driver) => {
    try {
      setLoadingRows((prev) => ({ ...prev, [driver.id]: true }));

      const response = await fetch(`/api/drivers/${driver.id}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: driver.name,
          subscription_amount: driver.subscription_amount,
          subscription_frequency: driver.subscription_frequency,
        }),
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        // Handle non-JSON response
        const text = await response.text();
        throw new Error(
          `Invalid response format. Expected JSON, got: ${text.substring(0, 100)}...`
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to sync driver with Stripe (Status: ${response.status})`
        );
      }

      await refreshDrivers();
      toast({
        title: "Success",
        description: `Driver ${driver.name} synced with Stripe successfully`,
      });
    } catch (error) {
      console.error("Error syncing driver with Stripe:", error);
      // Get more detailed error information
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sync driver with Stripe";

      toast({
        title: "Stripe Sync Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoadingRows((prev) => ({ ...prev, [driver.id]: false }));
    }
  };

  const handleDriverEdited = async () => {
    try {
      // First refresh the drivers data
      await refreshDrivers();

      // Show success toast
      toast({
        title: "Success",
        description: "Driver information updated successfully",
      });

      // Close the edit dialog
      setEditingDriver(null);
    } catch (error) {
      console.error("Error updating driver:", error);
      toast({
        title: "Error",
        description: "Failed to update driver information",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-destructive text-lg font-medium">{error}</div>
            <Button onClick={() => refreshDrivers()} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Drivers List</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers..."
                className="pl-8 w-[250px] transition-all duration-200 focus:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAllStripe}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync All
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {statusFilter === "all"
                    ? "All Status"
                    : statusFilter === "active"
                      ? "Active"
                      : "Inactive"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                  Active
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("inactive")}>
                  Inactive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Truck #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No drivers found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDrivers.map((driver) => {
                  const expiringDocs = getExpiringDocuments(driver);
                  const isConnected = !!driver.stripe_product_id;
                  return (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">
                        {driver.name}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 flex items-center gap-2"
                          onClick={() =>
                            window.open(`tel:${driver.phone_number}`)
                          }
                        >
                          <Phone className="h-4 w-4" />
                          {driver.phone_number}
                        </Button>
                      </TableCell>
                      <TableCell>{driver.truck_number}</TableCell>
                      <TableCell>{driver.solo_or_team}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            driver.status === "Active" ? "default" : "secondary"
                          }
                        >
                          {driver.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => setViewingDocuments(driver)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View
                          {expiringDocs.length > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-2 h-5 w-5 p-0 flex items-center justify-center"
                            >
                              {expiringDocs.length}
                            </Badge>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {isConnected ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="default"
                                  className="bg-green-500"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Connected
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ${driver.subscription_amount}/
                                {driver.subscription_frequency}
                              </div>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSyncStripe(driver)}
                              className="w-[140px]"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Connect Stripe
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingDriver(driver)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit driver
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingDriver(driver)}
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Delete driver
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination Controls */}
        {filteredDrivers.length > 0 && (
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to{" "}
              {Math.min(startIndex + driversPerPage, filteredDrivers.length)} of{" "}
              {filteredDrivers.length} drivers
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Dialogs */}
      {editingDriver && (
        <EditDriverDialog
          driver={editingDriver}
          open={!!editingDriver}
          onOpenChange={(open) => !open && setEditingDriver(null)}
          onDriverUpdated={handleDriverEdited}
        />
      )}

      {viewingDocuments && (
        <Dialog
          key={`view-dialog-${dialogKey}`}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setViewingDocuments(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Documents - {viewingDocuments.name}</DialogTitle>
              <DialogDescription>
                View and manage driver documents
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Driver License Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Driver License</h3>
                  {(!viewingDocuments.driver_licenses ||
                    viewingDocuments.driver_licenses.length === 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setUploadingDocument({
                          driver: viewingDocuments,
                          type: "license",
                        })
                      }
                    >
                      Upload License
                    </Button>
                  )}
                </div>
                {viewingDocuments.driver_licenses?.length > 0 ? (
                  <div className="space-y-2">
                    {viewingDocuments.driver_licenses.map((doc) => {
                      const expDate = parseISO(doc.expiration_date);
                      const currentDate = new Date();
                      const daysLeft =
                        Math.floor(
                          differenceInDays(
                            endOfDay(expDate),
                            startOfDay(currentDate)
                          )
                        ) + 1;
                      const isExpiringSoon = daysLeft <= 7 && daysLeft >= 0;
                      const isExpired = daysLeft < 0;

                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            isExpired && "border-red-200 bg-red-50",
                            isExpiringSoon && "border-yellow-200 bg-yellow-50"
                          )}
                        >
                          <div className="space-y-1">
                            <p className="font-medium">License Document</p>
                            <p className="text-sm text-muted-foreground">
                              Expires: {format(expDate, "MM/dd/yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {(isExpiringSoon || isExpired) && (
                              <div
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  isExpired
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                )}
                              >
                                {isExpired
                                  ? "Expired"
                                  : `${daysLeft} days left`}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setUploadingDocument({
                                    driver: viewingDocuments,
                                    type: "license",
                                  })
                                }
                                title="Replace License"
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() =>
                                  setDeletingDocument({
                                    id: doc.id,
                                    type: "license",
                                    name: "License Document",
                                  })
                                }
                                title="Delete License"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (doc.license_file_url) {
                                    window.open(doc.license_file_url, "_blank");
                                  }
                                }}
                                title="View License"
                                disabled={!doc.license_file_url}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No license documents uploaded
                  </div>
                )}
              </div>

              {/* Medical Card Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Medical Card</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setUploadingDocument({
                        driver: viewingDocuments,
                        type: "medical_card",
                      })
                    }
                  >
                    Upload New
                  </Button>
                </div>
                {viewingDocuments.medical_cards?.length > 0 ? (
                  <div className="space-y-2">
                    {viewingDocuments.medical_cards.map((doc) => {
                      const expDate = parseISO(doc.expiration_date);
                      const currentDate = new Date();
                      const daysLeft =
                        Math.floor(
                          differenceInDays(
                            endOfDay(expDate),
                            startOfDay(currentDate)
                          )
                        ) + 1;
                      const isExpiringSoon = daysLeft <= 7 && daysLeft >= 0;
                      const isExpired = daysLeft < 0;

                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            isExpired && "border-red-200 bg-red-50",
                            isExpiringSoon && "border-yellow-200 bg-yellow-50"
                          )}
                        >
                          <div className="space-y-1">
                            <p className="font-medium">Medical Card</p>
                            <p className="text-sm text-muted-foreground">
                              Expires: {format(expDate, "MM/dd/yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {(isExpiringSoon || isExpired) && (
                              <div
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  isExpired
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                )}
                              >
                                {isExpired
                                  ? "Expired"
                                  : `${daysLeft} days left`}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setUploadingDocument({
                                  driver: viewingDocuments,
                                  type: "medical_card",
                                })
                              }
                              title="Replace Medical Card"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() =>
                                setDeletingDocument({
                                  id: doc.id,
                                  type: "medical_card",
                                  name: "Medical Card",
                                })
                              }
                              title="Delete Medical Card"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (doc.file_link) {
                                  window.open(doc.file_link, "_blank");
                                }
                              }}
                              title="View Medical Card"
                              disabled={!doc.file_link}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No medical cards uploaded
                  </div>
                )}
              </div>

              {/* MVR Files Section */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">MVR Files</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setUploadingDocument({
                        driver: viewingDocuments,
                        type: "mvr",
                      })
                    }
                  >
                    Upload New
                  </Button>
                </div>
                {viewingDocuments.mvr_files?.length > 0 ? (
                  <div className="space-y-2">
                    {viewingDocuments.mvr_files.map((doc) => {
                      const expDate = parseISO(doc.expiration_date);
                      const currentDate = new Date();
                      const daysLeft =
                        Math.floor(
                          differenceInDays(
                            endOfDay(expDate),
                            startOfDay(currentDate)
                          )
                        ) + 1;
                      const isExpiringSoon = daysLeft <= 7 && daysLeft >= 0;
                      const isExpired = daysLeft < 0;

                      return (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            isExpired && "border-red-200 bg-red-50",
                            isExpiringSoon && "border-yellow-200 bg-yellow-50"
                          )}
                        >
                          <div className="space-y-1">
                            <p className="font-medium">MVR File</p>
                            <p className="text-sm text-muted-foreground">
                              Expires: {format(expDate, "MM/dd/yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {(isExpiringSoon || isExpired) && (
                              <div
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  isExpired
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                )}
                              >
                                {isExpired
                                  ? "Expired"
                                  : `${daysLeft} days left`}
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setUploadingDocument({
                                  driver: viewingDocuments,
                                  type: "mvr",
                                })
                              }
                              title="Replace MVR File"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() =>
                                setDeletingDocument({
                                  id: doc.id,
                                  type: "mvr",
                                  name: "MVR File",
                                })
                              }
                              title="Delete MVR File"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (doc.mvr_file_url) {
                                  window.open(doc.mvr_file_url, "_blank");
                                }
                              }}
                              title="View MVR File"
                              disabled={!doc.mvr_file_url}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No MVR files uploaded
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setViewingDocuments(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {uploadingDocument && (
        <UploadDocumentDialog
          key={`upload-dialog-${dialogKey}`}
          driverId={uploadingDocument.driver.id}
          driverName={uploadingDocument.driver.name}
          documentType={uploadingDocument.type}
          open={!!uploadingDocument}
          onOpenChange={(open) => {
            if (!open) {
              setUploadingDocument(null);
            }
          }}
          onDocumentUploaded={handleDocumentUploaded}
        />
      )}
      {deletingDocument && (
        <Dialog
          open={!!deletingDocument}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeleting) {
              setDeletingDocument(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deletingDocument.name}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this document? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingDocument(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!deletingDocument) return;

                  // Store document info for the API call
                  const docToDelete = {
                    id: deletingDocument.id,
                    type: deletingDocument.type,
                    name: deletingDocument.name,
                  };

                  // Show loading state but keep dialog open
                  setIsDeleting(true);

                  try {
                    // Make the API call while dialog remains open
                    const response = await fetch(`/api/documents/delete`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        type: docToDelete.type,
                        id: docToDelete.id,
                      }),
                    });

                    if (!response.ok) {
                      let errorMessage = "Failed to delete document";
                      try {
                        const errorData = await response.json();
                        if (errorData?.message) {
                          errorMessage = errorData.message;
                        }
                      } catch {
                        // Failed to parse error response as JSON
                      }
                      throw new Error(errorMessage);
                    }

                    // Now that API call has succeeded, close the dialog
                    setDeletingDocument(null);

                    // Show success toast
                    toast({
                      title: "Document deleted",
                      description: `${docToDelete.name} has been deleted successfully`,
                    });

                    // Increment dialog key to ensure proper refresh
                    setDialogKey((prev) => prev + 1);

                    // Close the viewing documents dialog if it's open
                    if (viewingDocuments) {
                      setViewingDocuments(null);

                      // Show a toast indicating the user needs to reopen the dialog
                      toast({
                        description:
                          "Document dialog closed. Reopen to view updated documents.",
                      });
                    }

                    // Refresh drivers data
                    await refreshDrivers();
                  } catch (error) {
                    // Safe error handling
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to delete document";

                    // Safe console logging
                    console.error(`Document deletion error:`, errorMessage);

                    toast({
                      title: "Delete failed",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
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
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {deletingDriver && (
        <DeleteDriverDialog
          driverId={deletingDriver.id}
          driverName={deletingDriver.name}
          onDriverDeleted={handleDriverDeleted}
          open={!!deletingDriver}
          onOpenChange={(open) => !open && setDeletingDriver(null)}
        />
      )}
    </Card>
  );
}
