"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditDriverDialog } from "./EditDriverDialog";
import { DeleteDriverDialog } from "./DeleteDriverDialog";
import { useDrivers } from "./DriversProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  format,
  differenceInDays,
  parseISO,
  endOfDay,
  startOfDay,
} from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { useToast } from "@/components/ui/use-toast";

interface Document {
  id: number;
  expiration_date: string;
  license_file_url?: string;
  file_link?: string;
  mvr_file_url?: string;
}

interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  solo_or_team: string;
  status: string;
  driver_licenses: Document[];
  medical_cards: Document[];
  mvr_files: Document[];
  company_id: number;
  subscription_amount: number;
  stripe_product_id: string | null;
  hire_date: string;
  terminated_date: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentWithType extends Document {
  type: "license" | "medical" | "mvr";
  name: string;
}

export function DriversTable() {
  const { drivers, loading, error, refreshDrivers } = useDrivers();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [viewingDocuments, setViewingDocuments] = useState<Driver | null>(null);
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

  const getExpiringDocuments = (driver: Driver): DocumentWithType[] => {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringDocs: DocumentWithType[] = [];

    const checkAndAddDocs = (
      docs: Document[],
      type: "license" | "medical" | "mvr",
      name: string
    ) => {
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

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-destructive text-lg font-medium">
              Error: {error}
            </div>
            <Button onClick={refreshDrivers} variant="outline">
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
        <ScrollArea className="h-[600px] pr-4">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Truck #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Search className="h-8 w-8 mb-3" />
                      <p className="text-sm">
                        {searchTerm
                          ? `No drivers found matching "${searchTerm}"`
                          : "No drivers available"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDrivers.map((driver) => (
                  <TableRow
                    key={driver.id}
                    className={cn(
                      "group transition-colors hover:bg-muted/50",
                      driver.status !== "Active" && "opacity-75"
                    )}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{driver.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {driver.phone_number}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{driver.truck_number}</TableCell>
                    <TableCell>
                      {driver.solo_or_team.charAt(0).toUpperCase() +
                        driver.solo_or_team.slice(1)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          driver.status === "Active" ? "success" : "secondary"
                        }
                        className="transition-colors"
                      >
                        {driver.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => setViewingDocuments(driver)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {getExpiringDocuments(driver).length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="text-yellow-600 animate-pulse">
                              <AlertTriangle className="h-4 w-4" />
                            </div>
                            <span className="text-xs text-yellow-600 font-medium">
                              {getExpiringDocuments(driver).length} expiring
                              soon
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingDriver(driver as Driver)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>Edit Driver</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDeletingDriver(driver as Driver)
                              }
                              className="text-destructive"
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              <span>Delete Driver</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setViewingDocuments(driver as Driver)
                              }
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              <span>View Documents</span>
                              {getExpiringDocuments(driver).length > 0 && (
                                <Badge variant="warning" className="ml-2">
                                  {getExpiringDocuments(driver).length}
                                </Badge>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
      {editingDriver && (
        <EditDriverDialog
          driver={editingDriver}
          onDriverUpdated={async () => {
            setEditingDriver(null);
            await refreshDrivers();
          }}
          open={true}
          onOpenChange={(open: boolean) => !open && setEditingDriver(null)}
        />
      )}
      {deletingDriver && (
        <DeleteDriverDialog
          driverId={deletingDriver.id}
          driverName={deletingDriver.name}
          onDriverDeleted={async () => {
            setDeletingDriver(null);
            await refreshDrivers();
          }}
          open={true}
          onOpenChange={(open: boolean) => !open && setDeletingDriver(null)}
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
                  {viewingDocuments.driver_licenses.length === 0 && (
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
                {viewingDocuments.driver_licenses.length > 0 ? (
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
                {viewingDocuments.medical_cards.length > 0 ? (
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
                {viewingDocuments.mvr_files.length > 0 ? (
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
    </Card>
  );
}
