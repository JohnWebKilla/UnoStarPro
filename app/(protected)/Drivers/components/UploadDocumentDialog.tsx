"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, Upload } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";

interface UploadDocumentDialogProps {
  driverId: number;
  driverName: string;
  documentType: "license" | "medical_card" | "mvr";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentUploaded: () => Promise<void>;
}

export function UploadDocumentDialog({
  driverId,
  driverName,
  documentType,
  open,
  onOpenChange,
  onDocumentUploaded,
}: UploadDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [expirationDate, setExpirationDate] = useState<Date>();
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file || !expirationDate) {
      toast({
        title: "Missing information",
        description: "Please select a file and expiration date",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);

      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("driverId", driverId.toString());
      formData.append("driverName", driverName);
      formData.append("documentType", documentType);
      formData.append("expirationDate", expirationDate.toISOString());

      // Upload the document
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Upload failed with status:", response.status);
        console.error("Error details:", errorData);
        throw new Error(`Failed to upload document: ${errorData}`);
      }

      // Show success message
      toast({
        title: "Document uploaded",
        description: "The document has been uploaded successfully",
      });

      // Trigger parent update and close dialog
      await onDocumentUploaded();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const documentTypeLabels = {
    license: "Driver License",
    medical_card: "Medical Card",
    mvr: "MVR File",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload {documentTypeLabels[documentType]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Document File</Label>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, JPG, PNG
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Expiration Date</Label>
            <Popover modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate
                    ? format(expirationDate, "PPP")
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || !file || !expirationDate}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
