"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ArrowLeft,
  FileText,
  Settings,
  History,
  User,
  Calendar,
  Loader2,
  Trash2,
  AlertCircle,
  Minus,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Driver } from "../types";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
import { createClient } from "@/utils/supabase/client";
import ReactCrop, { Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import html2canvas from "html2canvas";

export default function DriverDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const driverId = params.id as string;

  // Get the tab from URL query parameters if available
  const [activeTab, setActiveTab] = useState<string>("details");

  useEffect(() => {
    // Check if URL has a tab parameter
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      ["details", "documents", "logs", "settings"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    const fetchDriverDetails = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/drivers/${driverId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch driver details");
        }

        const data = await response.json();
        setDriver(data);
      } catch (error) {
        console.error("Error fetching driver details:", error);
        toast({
          title: "Error",
          description: "Failed to load driver details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (driverId) {
      fetchDriverDetails();
    }
  }, [driverId, toast]);

  function getStatusBadge(status: string | undefined | null) {
    if (!status) return null;

    const variants: Record<
      string,
      {
        variant:
          | "default"
          | "secondary"
          | "destructive"
          | "outline"
          | "success";
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
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  }

  return (
    <PageTransition>
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
            <h1 className="text-2xl font-bold tracking-tight">
              {isLoading ? <Skeleton className="h-8 w-48" /> : driver?.name}
            </h1>
            {!isLoading && driver?.status && getStatusBadge(driver.status)}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push(`/Drivers/${driverId}/edit`)}>
              Edit Driver
            </Button>
          </div>
        </div>

        <Tabs
          defaultValue={activeTab}
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
            {isLoading ? (
              <LoadingDriverDetails />
            ) : (
              <DriverDetails driver={driver} />
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            {isLoading ? (
              <LoadingDocuments />
            ) : (
              <DriverDocuments driver={driver} />
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 mt-4">
            {isLoading ? (
              <LoadingDriverLogs />
            ) : (
              <DriverLogs driverId={driverId} />
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            {isLoading ? (
              <LoadingDriverSettings />
            ) : (
              <DriverSettings driver={driver} setDriver={setDriver} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}

function LoadingDriverDetails() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Driver Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array(5)
            .fill(null)
            .map((_, i) => (
              <div key={i} className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-6 w-[200px]" />
              </div>
            ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array(3)
            .fill(null)
            .map((_, i) => (
              <div key={i} className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-6 w-[200px]" />
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingDocuments() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array(3)
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                className="flex justify-between items-center border-b pb-3 mb-3"
              >
                <div className="flex flex-col space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
                <Skeleton className="h-8 w-[70px]" />
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingDriverLogs() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(5)
              .fill(null)
              .map((_, i) => (
                <div key={i} className="flex flex-col space-y-2 border-b pb-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                  <Skeleton className="h-4 w-[300px]" />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingDriverSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Driver Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Array(3)
            .fill(null)
            .map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          <Skeleton className="h-10 w-[120px] mt-4" />
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentViewerDialog({
  open,
  onOpenChange,
  documentUrl,
  documentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentUrl: string | null;
  documentName: string;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isPdf, setIsPdf] = useState(false);
  const [renderMethod, setRenderMethod] = useState<
    "object" | "iframe" | "embed"
  >("object");
  const [rotation, setRotation] = useState(0);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(
    null
  );

  // Version control states
  const [versions, setVersions] = useState<
    {
      id: string;
      url: string;
      timestamp: string;
      isActive: boolean;
      name?: string;
    }[]
  >([]);
  const [showVersions, setShowVersions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [versionName, setVersionName] = useState("");

  // Document ID for version tracking
  const [documentId, setDocumentId] = useState<number | null>(null);
  // Document type for version tracking
  const [documentType, setDocumentType] = useState<string | null>(null);

  // Extract document ID and type from URL if present
  useEffect(() => {
    if (documentUrl) {
      try {
        // Try to extract ID from URL query params or path
        const urlObj = new URL(documentUrl, window.location.origin);
        const idParam = urlObj.searchParams.get("id");
        const pathParts = urlObj.pathname.split("/");
        const idFromPath = pathParts[pathParts.length - 1];

        // Extract document type from URL
        if (documentUrl.includes("license")) {
          setDocumentType("license");
        } else if (
          documentUrl.includes("medical_card") ||
          documentUrl.includes("medical-card")
        ) {
          setDocumentType("medical_card");
        } else if (documentUrl.includes("mvr")) {
          setDocumentType("mvr");
        }

        if (idParam && !isNaN(Number(idParam))) {
          setDocumentId(Number(idParam));
        } else if (idFromPath && !isNaN(Number(idFromPath))) {
          setDocumentId(Number(idFromPath));
        }
      } catch (error) {
        console.error("Error parsing document URL:", error);
      }
    }
  }, [documentUrl]);

  // Fetch versions when document ID and type are available
  useEffect(() => {
    if (documentId && documentType && open && !isPdf) {
      fetchVersions();
    }
  }, [documentId, documentType, open, isPdf]);

  // Function to fetch versions from API
  const fetchVersions = async () => {
    if (!documentId || !documentType) return;

    try {
      const response = await fetch(
        `/api/documents/versions?documentId=${documentId}&documentType=${documentType}`
      );
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error("Error fetching versions:", error);
    }
  };

  // Check if document is a PDF based on URL
  useEffect(() => {
    if (documentUrl) {
      // Check if URL contains .pdf or content-type includes pdf
      setIsPdf(
        documentUrl.toLowerCase().includes(".pdf") ||
          documentUrl.toLowerCase().includes("application/pdf")
      );
    }
  }, [documentUrl]);

  // Reset states when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setZoom(100);
      setRotation(0);
      setIsCropping(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCroppedImageUrl(null);
      setRenderMethod("object"); // Start with object tag
    }
  }, [open]);

  // Handle loading complete
  const handleLoad = () => {
    setIsLoading(false);
  };

  // Handle error for object tag
  const handleObjectError = () => {
    if (renderMethod === "object") {
      console.log("Object tag failed, trying iframe");
      setRenderMethod("iframe");
    } else if (renderMethod === "iframe") {
      console.log("Iframe failed, trying embed");
      setRenderMethod("embed");
    } else {
      setIsLoading(false);
      setError("Failed to load document. Please try opening in a new tab.");
    }
  };

  // Handle error
  const handleError = () => {
    setIsLoading(false);
    setError("Failed to load document. Please try again or download the file.");
  };

  // Zoom controls
  const zoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const zoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const resetZoom = () => {
    setZoom(100);
  };

  // Rotation controls
  const rotateLeft = () => {
    setRotation((prev) => (prev - 90) % 360);
  };

  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Toggle cropping mode
  const toggleCrop = () => {
    if (isCropping) {
      // If already cropping, cancel it
      setIsCropping(false);
      setCrop(undefined);
      setCompletedCrop(undefined);
    } else {
      // Reset zoom to 100% to ensure entire image is visible
      setZoom(100);
      setRotation(0);
      setIsCropping(true);
      // Default to a centered 80% crop area
      setCrop({
        unit: "%", // Use percentage units
        x: 10, // 10% from left
        y: 10, // 10% from top
        width: 80, // 80% of width
        height: 80, // 80% of height
      });
    }
  };

  // Modify the useEffect to load and store the original image
  useEffect(() => {
    if (documentUrl && !isPdf) {
      setIsLoading(true);

      // For Supabase URLs, we need to handle them differently due to security
      const isSupabaseUrl =
        documentUrl.includes("supabase") ||
        documentUrl.includes("storage.googleapis");

      // Create a new image to load the original - must set crossOrigin for canvas operations
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        console.log(
          "Original image loaded, dimensions:",
          img.width,
          "x",
          img.height
        );
        setOriginalImage(img);
        setIsLoading(false);
      };

      img.onerror = (e) => {
        console.error("Error loading original image:", e);
        setIsLoading(false);
        setError(
          "Failed to load the image. It may be restricted by security settings."
        );
      };

      // Use fetch for Supabase URLs to handle CORS
      if (isSupabaseUrl) {
        fetch(documentUrl)
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.blob();
          })
          .then((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            img.src = objectUrl;
          })
          .catch((err) => {
            console.error("Error fetching image:", err);
            // Try direct loading as fallback
            img.src = documentUrl;
          });
      } else {
        img.src = documentUrl;
      }
    }
  }, [documentUrl, isPdf]);

  // Remove the problematic proxy effect that's causing errors
  // Replacing with a safer approach that doesn't involve multiple image loads
  useEffect(() => {
    if (documentUrl && !isPdf && !isCropping) {
      // Reset cropped image when document changes
      setCroppedImageUrl(null);
    }
  }, [documentUrl, isPdf, isCropping]);

  // Add an alternative approach for handling CORS issues (simplified)
  const proxyImg = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error("Network response was not ok");
          return response.blob();
        })
        .then((blob) => {
          resolve(URL.createObjectURL(blob));
        })
        .catch((err) => {
          console.error("Error proxying image:", err);
          reject(err);
        });
    });
  };

  // Simplified crop application that doesn't depend on zoom
  const applyCrop = useCallback(() => {
    if (!completedCrop || !originalImage) {
      toast({
        title: "Error",
        description: "No crop selection made or image not loaded.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Log the original image dimensions
      console.log(
        "Applying crop to image:",
        originalImage.width,
        "x",
        originalImage.height
      );
      console.log("Crop values:", completedCrop);

      // Create a canvas to draw the cropped image
      const canvas = document.createElement("canvas");

      // Calculate pixel values from percentages
      const scaleX = originalImage.naturalWidth / 100;
      const scaleY = originalImage.naturalHeight / 100;

      // Convert percentage crop to pixels
      const cropX = Math.round(completedCrop.x * scaleX);
      const cropY = Math.round(completedCrop.y * scaleY);
      const cropWidth = Math.round(completedCrop.width * scaleX);
      const cropHeight = Math.round(completedCrop.height * scaleY);

      // Log the calculated crop dimensions
      console.log(
        "Calculated crop dimensions:",
        cropX,
        cropY,
        cropWidth,
        cropHeight
      );

      // Set canvas size to cropped dimensions
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Get context and set image smoothing
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Clear canvas with white background to avoid transparency issues
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the cropped portion of the image
      ctx.drawImage(
        originalImage,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      // Convert to data URL
      const croppedImageData = canvas.toDataURL("image/jpeg", 0.95);

      // Create a test image to verify the data URL works
      const testImg = new Image();
      testImg.onload = () => {
        // Image loaded successfully, data URL is valid
        console.log(
          "Cropped image dimensions:",
          testImg.width,
          "x",
          testImg.height
        );
        setCroppedImageUrl(croppedImageData);
        setIsCropping(false);

        // Check if document type and ID are available to save version
        if (documentId && documentType) {
          // Automatically show the save version dialog
          setVersionName(`Cropped ${new Date().toLocaleString()}`);
          setTimeout(() => {
            setShowVersions(true);
          }, 500); // Short delay to ensure UI updates first
        }

        toast({
          title: "Crop Applied",
          description:
            "Image has been cropped successfully. You can save this as a new version.",
          action:
            documentId && documentType ? (
              <Button
                variant="outline"
                className="bg-background text-foreground"
                onClick={() => setShowVersions(true)}
              >
                Save Version
              </Button>
            ) : undefined,
        });
      };

      testImg.onerror = () => {
        console.error("Error loading cropped image preview");
        throw new Error("Generated image data is invalid");
      };

      // Attempt to load the data URL
      testImg.src = croppedImageData;
    } catch (error) {
      console.error("Error applying crop:", error);
      toast({
        title: "Error",
        description: "Failed to apply crop to image",
        variant: "destructive",
      });
      setIsCropping(false);
    }
  }, [completedCrop, originalImage, toast, documentId, documentType]);

  // Save version to database
  const saveVersion = async () => {
    if (!croppedImageUrl || !documentId || !documentType) {
      toast({
        title: "Error",
        description:
          "No cropped image, document ID, or document type available",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);

      // Convert data URL to blob for upload
      const res = await fetch(croppedImageUrl);
      const blob = await res.blob();

      // Create form data for upload
      const formData = new FormData();
      formData.append("file", blob, `version_${Date.now()}.jpg`);
      formData.append("documentId", documentId.toString());
      formData.append("documentType", documentType);
      formData.append(
        "versionName",
        versionName || `Version ${new Date().toLocaleString()}`
      );

      // Upload to server
      const response = await fetch("/api/documents/versions/create", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save version");
      }

      const data = await response.json();

      // Add new version to list
      setVersions((prev) => [
        ...prev,
        {
          id: data.id,
          url: data.url,
          timestamp: new Date().toISOString(),
          isActive: true,
        },
      ]);

      toast({
        title: "Version Saved",
        description: "Your cropped version has been saved.",
      });

      // Close version dialog
      setShowVersions(false);
    } catch (error) {
      console.error("Error saving version:", error);
      toast({
        title: "Error",
        description: "Failed to save version",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a version
  const deleteVersion = async (versionId: string) => {
    if (!confirm("Are you sure you want to delete this version?")) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/versions/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          versionId,
          documentId,
          documentType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete version");
      }

      // Remove version from list
      setVersions((prev) => prev.filter((v) => v.id !== versionId));

      toast({
        title: "Version Deleted",
        description: "The version has been deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting version:", error);
      toast({
        title: "Error",
        description: "Failed to delete version",
        variant: "destructive",
      });
    }
  };

  // Render the PDF with the appropriate tag
  const renderPdf = () => {
    // For Supabase storage URLs, we need to ensure we don't break the token
    let pdfUrl;
    if (documentUrl?.includes("supabase")) {
      // Preserve Supabase storage URLs which may contain tokens
      pdfUrl = documentUrl;
    } else {
      // Regular URLs can be modified with zoom parameter
      pdfUrl = documentUrl?.includes("?")
        ? `${documentUrl}&zoom=${zoom}`
        : `${documentUrl}?zoom=${zoom}`;
    }

    if (renderMethod === "object") {
      return (
        <object
          data={pdfUrl}
          type="application/pdf"
          className="w-full h-full"
          style={{ height: "100%", minHeight: "65vh" }}
          onLoad={handleLoad}
          onError={handleObjectError}
        >
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
            <p className="font-medium">
              Your browser doesn't support PDF embedding.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.open(documentUrl || "", "_blank")}
            >
              Open PDF in New Tab
            </Button>
          </div>
        </object>
      );
    } else if (renderMethod === "iframe") {
      return (
        <iframe
          src={pdfUrl}
          className="w-full h-full"
          style={{ height: "100%", minHeight: "65vh" }}
          onLoad={handleLoad}
          onError={handleObjectError}
        />
      );
    } else {
      return (
        <embed
          src={pdfUrl}
          type="application/pdf"
          className="w-full h-full"
          style={{ height: "100%", minHeight: "65vh" }}
          onLoad={handleLoad}
          onError={handleError}
        />
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[900px] sm:max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {documentName}
            {isPdf && (
              <Badge variant="outline" className="ml-2">
                PDF
              </Badge>
            )}
          </DialogTitle>
          <div className="flex items-center space-x-2">
            {!isPdf && !isLoading && !error && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rotateLeft}
                  className="h-8 w-8 p-0 rounded-full"
                  title="Rotate Left"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rotateRight}
                  className="h-8 w-8 p-0 rounded-full"
                  title="Rotate Right"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleCrop}
                  className={cn(
                    "h-8 p-1 text-xs",
                    isCropping && "bg-primary text-primary-foreground"
                  )}
                  title="Crop Image"
                >
                  Crop
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={zoom <= 50}
              className="h-8 w-8 p-0 rounded-full"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-sm w-14 text-center">{zoom}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={zoom >= 200}
              className="h-8 w-8 p-0 rounded-full"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetZoom}
              className="h-8 text-xs"
            >
              Reset
            </Button>
          </div>
        </DialogHeader>
        <div
          className="relative overflow-auto flex-grow"
          style={{ height: "65vh", maxHeight: "65vh" }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-6 text-center z-10">
              <AlertCircle className="h-10 w-10 text-destructive mb-2" />
              <p className="text-destructive font-medium">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.open(documentUrl || "", "_blank")}
              >
                Download Instead
              </Button>
            </div>
          )}
          {documentUrl && (
            <div className="h-full w-full flex items-center justify-center">
              {isPdf ? (
                renderPdf()
              ) : (
                <div className="relative flex items-center justify-center overflow-auto h-full w-full">
                  {isCropping && (
                    <div className="absolute top-2 left-0 right-0 text-center z-10">
                      <div className="bg-background/80 text-primary inline-block px-3 py-1 rounded-md shadow-md">
                        Drag to adjust crop area. Click "Apply Crop" when done.
                      </div>
                    </div>
                  )}

                  {isCropping ? (
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={undefined}
                      className="max-w-none"
                    >
                      <img
                        ref={imageRef}
                        src={documentUrl}
                        alt={documentName}
                        style={{
                          maxWidth: "none",
                          maxHeight: "calc(65vh - 120px)", // Ensure image fits in the visible area
                          transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                          transformOrigin: "center center",
                        }}
                        onLoad={handleLoad}
                        onError={handleError}
                        crossOrigin="anonymous"
                      />
                    </ReactCrop>
                  ) : (
                    <img
                      src={croppedImageUrl || documentUrl}
                      alt={documentName}
                      className="max-h-full object-contain"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        transformOrigin: "center center",
                      }}
                      onLoad={handleLoad}
                      onError={handleError}
                    />
                  )}

                  {/* Hidden canvas for cropping */}
                  <canvas
                    ref={previewCanvasRef}
                    style={{
                      display: "none",
                      width: completedCrop?.width ?? 0,
                      height: completedCrop?.height ?? 0,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="p-4 border-t mt-auto shrink-0">
          {isCropping ? (
            <>
              <Button variant="outline" onClick={toggleCrop}>
                Cancel
              </Button>
              <Button onClick={applyCrop}>Apply Crop</Button>
            </>
          ) : (
            <>
              {!isPdf && (
                <>
                  {croppedImageUrl && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCroppedImageUrl(null);
                        // Reset zoom and rotation when resetting crop
                        setZoom(100);
                        setRotation(0);
                      }}
                      className="mr-2"
                    >
                      Reset Crop
                    </Button>
                  )}

                  {croppedImageUrl && documentId && documentType && (
                    <Button
                      variant="secondary"
                      onClick={() => setShowVersions(true)}
                      className="mr-2"
                    >
                      Save Version
                    </Button>
                  )}

                  {versions.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setShowVersions(true)}
                      className="mr-2"
                    >
                      Manage Versions ({versions.length})
                    </Button>
                  )}
                </>
              )}

              <Button
                variant="outline"
                onClick={() =>
                  window.open(croppedImageUrl || documentUrl || "", "_blank")
                }
              >
                Open in New Tab
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Version Control Dialog */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {croppedImageUrl && !versions.length
                ? "Save New Version"
                : "Manage Versions"}
            </DialogTitle>
            <DialogDescription>
              {croppedImageUrl && !versions.length
                ? "Save your cropped image as a new version"
                : "View and manage document versions"}
            </DialogDescription>
          </DialogHeader>

          {croppedImageUrl && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="version-name">Version Name</Label>
                <Input
                  id="version-name"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="Enter a name for this version"
                />
              </div>

              <div className="flex justify-center border rounded-md p-2">
                <img
                  src={croppedImageUrl}
                  alt="Preview"
                  className="max-h-[200px] object-contain"
                />
              </div>
            </div>
          )}

          {versions.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto border rounded-md p-2">
              <div className="space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-2 border rounded-md flex items-center justify-between ${
                      version.isActive ? "bg-primary/10 border-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={version.url}
                        alt={`Version ${version.id}`}
                        className="w-12 h-12 object-cover rounded-md"
                      />
                      <div>
                        <p className="font-medium text-sm">
                          {version.name || version.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(version.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCroppedImageUrl(version.url);
                          setShowVersions(false);
                        }}
                      >
                        View
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteVersion(version.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            {croppedImageUrl && (
              <Button onClick={saveVersion} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Version"
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowVersions(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function DriverDetails({ driver }: { driver: Driver | null }) {
  if (!driver) return null;

  // Local function to get status badge
  function getStatusBadge(status: string | undefined | null) {
    if (!status) return null;

    const variants: Record<
      string,
      {
        variant:
          | "default"
          | "secondary"
          | "destructive"
          | "outline"
          | "success";
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
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  }

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
            <div>{getStatusBadge(driver.status)}</div>
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

function DriverDocuments({ driver }: { driver: Driver | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<{
    licenses: any[];
    medicalCards: any[];
    mvrFiles: any[];
  }>({
    licenses: [],
    medicalCards: [],
    mvrFiles: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>("license");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState<string>("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<{
    url: string | null;
    name: string;
  }>({ url: null, name: "" });
  const [supabaseClient, setSupabaseClient] = useState<any>(null);

  useEffect(() => {
    async function fetchDocuments() {
      if (!driver?.id) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/documents?driverId=${driver.id}`);

        if (!response.ok) {
          throw new Error("Failed to fetch documents");
        }

        const data = await response.json();
        setDocuments(data);
      } catch (err) {
        console.error("Error fetching documents:", err);
        setError("Failed to load documents");
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocuments();
  }, [driver?.id]);

  useEffect(() => {
    setSupabaseClient(createClient());
  }, []);

  const ensureDocumentsBucket = async () => {
    if (!supabaseClient) return false;

    try {
      // First check if bucket exists
      const { data: buckets, error: listError } =
        await supabaseClient.storage.listBuckets();

      if (listError) {
        console.error("Error listing buckets:", listError);
        return false;
      }

      const documentsBucket = buckets?.find((b: any) => b.name === "documents");

      if (!documentsBucket) {
        console.log("Documents bucket not found, creating...");

        // Try to create the bucket
        const { data: newBucket, error: createError } =
          await supabaseClient.storage.createBucket("documents", {
            public: true,
            allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
            fileSizeLimit: 52428800, // 50MB
          });

        if (createError) {
          console.error("Error creating bucket:", createError);
          return false;
        }

        console.log("Created new bucket:", newBucket);
      }

      // Update bucket to ensure it's public
      const { error: updateError } = await supabaseClient.storage.updateBucket(
        "documents",
        {
          public: true,
          allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
          fileSizeLimit: 52428800, // 50MB
        }
      );

      if (updateError) {
        console.error("Error updating bucket:", updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error ensuring documents bucket:", error);
      return false;
    }
  };

  useEffect(() => {
    if (supabaseClient) {
      ensureDocumentsBucket();
    }
  }, [supabaseClient]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !driver) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive",
      });
      return;
    }

    setUploadingDocument(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("driverId", driver.id.toString());
      formData.append("driverName", driver.name || "Unknown Driver");
      formData.append(
        "documentType",
        uploadType === "medical" ? "medical_card" : uploadType
      );
      formData.append(
        "expirationDate",
        expirationDate || new Date().toISOString().split("T")[0]
      );

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload document");
      }

      setSelectedFile(null);
      setExpirationDate("");
      setUploadType("license");
      setUploadOpen(false);

      // Refresh documents
      fetchDocuments();

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Error",
        description: `Failed to upload document: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
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
      // Convert type to match the expected format in the API
      const documentType = type === "medical" ? "medical_card" : type;

      const response = await fetch("/api/documents/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, type: documentType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete document");
      }

      // Refresh documents
      fetchDocuments();

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error",
        description: `Failed to delete document: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
    }
  };

  function formatDate(date: string | null) {
    if (!date) return "N/A";
    return format(new Date(String(date)), "MMM d, yyyy");
  }

  function isExpiringSoon(date: string | null) {
    if (!date) return false;

    const expDate = new Date(date);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return expDate <= thirtyDaysFromNow;
  }

  function fetchDocuments() {
    if (!driver?.id) return;

    setIsLoading(true);
    fetch(`/api/documents?driverId=${driver.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch documents");
        return res.json();
      })
      .then((data) => {
        setDocuments(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching documents:", err);
        setError("Failed to load documents");
        setIsLoading(false);
      });
  }

  if (!driver) return null;

  const allDocumentsCount =
    documents.licenses.length +
    documents.medicalCards.length +
    documents.mvrFiles.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Driver Documents</h2>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="py-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col space-y-2 border rounded-lg p-4"
                >
                  <Skeleton className="h-5 w-40" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Driver Documents</h2>
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
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setUploadType(e.target.value)
                  }
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

      {error ? (
        <Card>
          <CardContent className="py-6">
            <div className="text-center text-destructive">
              <p>{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={fetchDocuments}
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : allDocumentsCount === 0 ? (
        <Card>
          <CardContent className="py-6">
            <div className="text-center">
              <p className="text-muted-foreground">No documents found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setUploadOpen(true)}
              >
                Add Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
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
                  Commercial Driver License documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documents.licenses.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">
                      No license documents found
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {documents.licenses.map((license) => (
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
                              onClick={() => {
                                setCurrentDocument({
                                  url: license.license_file_url,
                                  name: "Driver License",
                                });
                                setViewerOpen(true);
                              }}
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
                {documents.medicalCards.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">
                      No medical card documents found
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {documents.medicalCards.map((medical) => (
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
                              onClick={() => {
                                setCurrentDocument({
                                  url: medical.file_link,
                                  name: "Medical Card",
                                });
                                setViewerOpen(true);
                              }}
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
                {documents.mvrFiles.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">
                      No MVR documents found
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {documents.mvrFiles.map((mvr) => (
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
                              onClick={() => {
                                setCurrentDocument({
                                  url: mvr.mvr_file_url,
                                  name: "MVR File",
                                });
                                setViewerOpen(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-2" /> View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDeleteDocument(mvr.id, "mvr")
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
      )}

      {/* Document Viewer Dialog */}
      <DocumentViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        documentUrl={currentDocument.url}
        documentName={currentDocument.name}
      />
    </div>
  );
}

function DriverLogs({ driverId }: { driverId: string }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This would be replaced with actual API call once implemented
    setIsLoading(true);
    setTimeout(() => {
      setLogs([]);
      setIsLoading(false);
    }, 1000);
  }, [driverId]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Activity Logs</h2>

      <Card>
        <CardContent className="py-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-4">
              {/* Log entries would go here */}
              <p>Log entries will be displayed here</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground">No activity logs found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DriverSettings({
  driver,
  setDriver,
}: {
  driver: Driver | null;
  setDriver: React.Dispatch<React.SetStateAction<Driver | null>>;
}) {
  const { toast } = useToast();

  // Local function to get status badge
  function getStatusBadge(status: string | undefined | null) {
    if (!status) return null;

    const variants: Record<
      string,
      {
        variant:
          | "default"
          | "secondary"
          | "destructive"
          | "outline"
          | "success";
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
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  }

  const handleUpdateStatus = async (status: string) => {
    if (!driver) return;

    try {
      // This would be replaced with actual API call
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update driver status");
      }

      const updatedDriver = await response.json();
      setDriver(updatedDriver);

      toast({
        title: "Status updated",
        description: `Driver status has been updated to ${status}`,
      });
    } catch (error) {
      console.error("Error updating driver status:", error);
      toast({
        title: "Error",
        description: "Failed to update driver status",
        variant: "destructive",
      });
    }
  };

  if (!driver) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Driver Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Status Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Current Status</p>
            <div>{getStatusBadge(driver.status)}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={driver.status === "active" ? "secondary" : "outline"}
              onClick={() => handleUpdateStatus("active")}
              disabled={driver.status === "active"}
            >
              Set Active
            </Button>
            <Button
              variant={driver.status === "inactive" ? "secondary" : "outline"}
              onClick={() => handleUpdateStatus("inactive")}
              disabled={driver.status === "inactive"}
            >
              Set Inactive
            </Button>
            <Button
              variant={
                driver.status === "terminated" ? "secondary" : "destructive"
              }
              onClick={() => handleUpdateStatus("terminated")}
              disabled={driver.status === "terminated"}
            >
              Set Terminated
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
