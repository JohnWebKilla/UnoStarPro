"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Calendar, Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Document {
  id: number;
  driver_id: number;
  expiration_date: string | null;
  created_at: string;
}

interface LicenseDocument extends Document {
  license_file_url: string;
  license_number?: string;
  state?: string;
}

interface MedicalDocument extends Document {
  file_link: string;
}

interface MvrDocument extends Document {
  mvr_file_url: string;
}

interface Driver {
  id: number;
  name: string;
  phone_number: string;
  truck_number: string;
  status: string;
}

export default function DriverDocumentsPage() {
  const params = useParams();
  const driverId = params.id as string;
  const { toast } = useToast();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [licenses, setLicenses] = useState<LicenseDocument[]>([]);
  const [medicalCards, setMedicalCards] = useState<MedicalDocument[]>([]);
  const [mvrFiles, setMvrFiles] = useState<MvrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("license");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState<string>("");

  useEffect(() => {
    fetchDriver();
    fetchDocuments();
  }, [driverId]);

  const fetchDriver = async () => {
    try {
      const response = await fetch(`/api/drivers/${driverId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch driver");
      }
      const data = await response.json();
      setDriver(data);
    } catch (error) {
      console.error("Error fetching driver:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load driver information",
      });
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents?driverId=${driverId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setLicenses(data.licenses || []);
      setMedicalCards(data.medicalCards || []);
      setMvrFiles(data.mvrFiles || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load driver documents",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a file to upload",
      });
      return;
    }

    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append("driverId", driverId);
      formData.append("type", uploadType);
      formData.append("file", selectedFile);

      if (expirationDate) {
        formData.append("expirationDate", expirationDate);
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });

      fetchDocuments();
      setUploadOpen(false);
      setSelectedFile(null);
      setExpirationDate("");
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload document",
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (id: number, type: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${id}?type=${type}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete document",
      });
    }
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;

    const expDate = new Date(date);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return expDate <= thirtyDaysFromNow;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {driver?.name || "Driver"}'s Documents
          </h1>
          <p className="text-muted-foreground">
            Manage driver license, medical card, and MVR records
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>Upload Document</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Upload New Document</DialogTitle>
              <DialogDescription>
                Add a new document for this driver. Select the document type and
                provide the necessary information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="document-type">Document Type</Label>
                <select
                  id="document-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                >
                  <option value="license">Driver License</option>
                  <option value="medical">Medical Card</option>
                  <option value="mvr">MVR</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="document-file">Document File</Label>
                <Input
                  id="document-file"
                  type="file"
                  onChange={handleFileChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiration-date">Expiration Date</Label>
                <Input
                  id="expiration-date"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleUpload}
                disabled={!selectedFile || uploadingDocument}
              >
                {uploadingDocument ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Driver Information</CardTitle>
          <CardDescription>Basic driver details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{driver?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{driver?.phone_number || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Truck Number</p>
              <p className="font-medium">{driver?.truck_number || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={driver?.status === "Active" ? "success" : "secondary"}
              >
                {driver?.status || "N/A"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="licenses">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="licenses">Driver Licenses</TabsTrigger>
          <TabsTrigger value="medical">Medical Cards</TabsTrigger>
          <TabsTrigger value="mvr">MVR Files</TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Driver Licenses</CardTitle>
              <CardDescription>
                Commercial Driver License documents and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {licenses.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">
                    No license documents found
                  </p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {licenses.map((license) => (
                    <div
                      key={license.id}
                      className="border rounded-lg p-4 grid gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">Driver License</h3>
                          <p className="text-sm text-muted-foreground">
                            Uploaded: {formatDate(license.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(license.license_file_url, "_blank")
                            }
                          >
                            <FileText className="h-4 w-4 mr-2" /> View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDeleteDocument(license.id, "license")
                            }
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">
                            Expires:{" "}
                            <span
                              className={
                                isExpiringSoon(license.expiration_date)
                                  ? "text-red-500 font-medium"
                                  : ""
                              }
                            >
                              {formatDate(license.expiration_date)}
                              {isExpiringSoon(license.expiration_date) &&
                                " (Expiring Soon)"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Medical Cards</CardTitle>
              <CardDescription>
                DOT medical examination certificates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {medicalCards.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">
                    No medical card documents found
                  </p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {medicalCards.map((medical) => (
                    <div
                      key={medical.id}
                      className="border rounded-lg p-4 grid gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">Medical Card</h3>
                          <p className="text-sm text-muted-foreground">
                            Uploaded: {formatDate(medical.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(medical.file_link, "_blank")
                            }
                          >
                            <FileText className="h-4 w-4 mr-2" /> View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDeleteDocument(medical.id, "medical")
                            }
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">
                            Expires:{" "}
                            <span
                              className={
                                isExpiringSoon(medical.expiration_date)
                                  ? "text-red-500 font-medium"
                                  : ""
                              }
                            >
                              {formatDate(medical.expiration_date)}
                              {isExpiringSoon(medical.expiration_date) &&
                                " (Expiring Soon)"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mvr" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>MVR Files</CardTitle>
              <CardDescription>Motor Vehicle Record reports</CardDescription>
            </CardHeader>
            <CardContent>
              {mvrFiles.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">
                    No MVR documents found
                  </p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {mvrFiles.map((mvr) => (
                    <div
                      key={mvr.id}
                      className="border rounded-lg p-4 grid gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">MVR File</h3>
                          <p className="text-sm text-muted-foreground">
                            Uploaded: {formatDate(mvr.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(mvr.mvr_file_url, "_blank")
                            }
                          >
                            <FileText className="h-4 w-4 mr-2" /> View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDocument(mvr.id, "mvr")}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">
                            Expires:{" "}
                            <span
                              className={
                                isExpiringSoon(mvr.expiration_date)
                                  ? "text-red-500 font-medium"
                                  : ""
                              }
                            >
                              {formatDate(mvr.expiration_date)}
                              {isExpiringSoon(mvr.expiration_date) &&
                                " (Expiring Soon)"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
