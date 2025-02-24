"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  category_id: string;
  ticket_id?: number;
  requires_signature: boolean;
  signature_status: string;
  signature_fields?: SignatureField[];
  file_type: string;
  created_at: string;
  created_by: string;
  signature_requests?: SignatureRequest[];
}

interface SignatureField {
  id: string;
  type: "signature" | "name" | "date" | "text" | "email";
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  label: string;
  value?: string;
  assignedTo?: string;
}

interface SignatureRequest {
  id: string;
  document_id: string;
  signer_email: string;
  signer_name: string;
  status: string;
  access_token: string;
  created_at: string;
}

interface PrepareSignatureState {
  isOpen: boolean;
  documentId: string | null;
  documentUrl: string | null;
  fields: SignatureField[];
  currentPage: number;
}

export default function DocsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [prepareSignature, setPrepareSignature] =
    useState<PrepareSignatureState>({
      isOpen: false,
      documentId: null,
      documentUrl: null,
      fields: [],
      currentPage: 1,
    });
  const [signatureDialog, setSignatureDialog] = useState({
    isOpen: false,
    documentId: null as string | null,
    currentPage: 1,
    totalPages: 1,
    fields: [] as SignatureField[],
    selectedTool: "signature" as SignatureField["type"],
    pdfUrl: null as string | null,
  });
  const [sendSignatureDialog, setSendSignatureDialog] = useState({
    isOpen: false,
    documentId: null as string | null,
    signerEmail: "",
    signerName: "",
  });
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeField, setResizeField] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error fetching documents");
      return;
    }

    setDocuments(data || []);
  };

  const ensureDocumentsBucket = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("Authentication error:", userError);
        return false;
      }

      // First check if bucket exists
      const { data: buckets, error: listError } =
        await supabase.storage.listBuckets();
      console.log("Existing buckets:", buckets);

      if (listError) {
        console.error("Error listing buckets:", listError);
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      const documentsBucket = buckets?.find((b) => b.name === "documents");

      if (!documentsBucket) {
        console.log("Documents bucket not found, creating...");

        // Try to create the bucket
        const { data: newBucket, error: createError } =
          await supabase.storage.createBucket("documents", {
            public: true,
            allowedMimeTypes: ["application/pdf"],
            fileSizeLimit: 52428800, // 50MB
          });

        if (createError) {
          console.error("Error creating bucket:", createError);
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }

        console.log("Created new bucket:", newBucket);
        return true;
      }

      console.log("Documents bucket exists:", documentsBucket);

      // Update bucket to ensure it's public
      const { error: updateError } = await supabase.storage.updateBucket(
        "documents",
        {
          public: true,
          allowedMimeTypes: ["application/pdf"],
          fileSizeLimit: 52428800, // 50MB
        }
      );

      if (updateError) {
        console.error("Error updating bucket:", updateError);
        throw new Error(`Failed to update bucket: ${updateError.message}`);
      }

      return true;
    } catch (error: any) {
      console.error("Error in ensureDocumentsBucket:", error);
      toast.error(error.message || "Failed to configure storage");
      return false;
    }
  };

  const normalizeFilePath = (path: string) => {
    // Remove any leading slashes and ensure proper formatting
    return path.replace(/^\/+/, "");
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          toast.error("Authentication error");
          return;
        }

        // Ensure bucket exists
        const bucketExists = await ensureDocumentsBucket();
        if (!bucketExists) {
          toast.error("Failed to configure storage");
          return;
        }

        for (const file of acceptedFiles) {
          try {
            if (file.type !== "application/pdf") {
              toast.error(`${file.name} is not a PDF file`);
              continue;
            }

            const fileExt = file.name.split(".").pop();
            const timestamp = new Date().getTime();
            const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = normalizeFilePath(`${user.id}/${fileName}`);

            console.log("Uploading file:", { fileName, filePath });

            // Create user folder first
            const { error: uploadError } = await supabase.storage
              .from("documents")
              .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: "application/pdf",
              });

            if (uploadError) {
              console.error("Storage upload error:", uploadError);
              toast.error(`Upload error: ${uploadError.message}`);
              continue;
            }

            // Create document record in the database
            const { error: dbError } = await supabase.from("documents").insert({
              name: file.name,
              file_path: filePath,
              category_id: selectedCategory,
              file_size: file.size,
              file_type: file.type,
              created_by: user.id,
              signature_status: "pending",
            });

            if (dbError) {
              console.error("Database insert error:", dbError);
              await supabase.storage.from("documents").remove([filePath]);
              toast.error(`Database error: ${dbError.message}`);
              continue;
            }

            toast.success(`${file.name} uploaded successfully!`);
          } catch (error: any) {
            console.error("File processing error:", error);
            toast.error(`Error processing ${file.name}`);
          }
        }

        await fetchDocuments();
      } catch (error: any) {
        console.error("Global upload error:", error);
        toast.error(error.message || "An unexpected error occurred");
      }
    },
    [selectedCategory, supabase]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("document_categories")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Error fetching categories");
      return;
    }

    setCategories(data || []);
  };

  const createCategory = async () => {
    try {
      console.log("Creating category:", { newCategoryName, newCategoryDesc });

      if (!newCategoryName.trim()) {
        toast.error("Category name is required");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log("Auth user:", user);

      if (userError) {
        console.error("Auth error:", userError);
        toast.error("Authentication error");
        return;
      }

      if (!user) {
        console.error("No user found");
        toast.error("User not authenticated");
        return;
      }

      console.log("Inserting category with data:", {
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim(),
        created_by: user.id,
      });

      const { data, error } = await supabase
        .from("document_categories")
        .insert({
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Category creation error:", error);
        toast.error(`Error creating category: ${error.message}`);
        return;
      }

      console.log("Category created:", data);
      toast.success("Category created successfully!");
      setNewCategoryName("");
      setNewCategoryDesc("");
      await fetchCategories();
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const openSignatureDialog = async (doc: Document) => {
    try {
      console.log("Opening signature dialog for document:", doc);

      const url = await getDocumentUrl(doc.file_path);
      if (!url) {
        console.error("Could not get document URL");
        return;
      }

      setSignatureDialog({
        isOpen: true,
        documentId: doc.id,
        currentPage: 1,
        totalPages: 1,
        fields: doc.signature_fields || [],
        selectedTool: "signature",
        pdfUrl: url,
      });
    } catch (error) {
      console.error("Error opening signature dialog:", error);
      toast.error("Could not open document for signature preparation");
    }
  };

  const handleFieldAdd = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pdfContainerRef.current || !signatureDialog.documentId) return;

    // Check if field type already exists
    const existingField = signatureDialog.fields.find(
      (f) => f.type === signatureDialog.selectedTool
    );
    if (existingField) {
      toast.error(
        `A ${getFieldLabel(signatureDialog.selectedTool)} field already exists`
      );
      return;
    }

    // Get the iframe element
    const iframe = pdfContainerRef.current.querySelector("iframe");
    if (!iframe) return;

    // Get the bounding rectangles
    const iframeRect = iframe.getBoundingClientRect();

    // Calculate position relative to the iframe
    const x = ((event.clientX - iframeRect.left) / iframeRect.width) * 100;
    const y = ((event.clientY - iframeRect.top) / iframeRect.height) * 100;

    // Only add field if click is within iframe bounds
    if (
      event.clientX >= iframeRect.left &&
      event.clientX <= iframeRect.right &&
      event.clientY >= iframeRect.top &&
      event.clientY <= iframeRect.bottom
    ) {
      // Set default sizes based on field type
      let width = 15;
      let height = 4;

      switch (signatureDialog.selectedTool) {
        case "signature":
          width = 20; // Wider for signatures
          height = 8; // Taller for signatures
          break;
        case "name":
          width = 18; // Full name needs more width
          height = 5;
          break;
        case "date":
          width = 12; // Dates are shorter
          height = 5;
          break;
        case "email":
          width = 22; // Emails can be long
          height = 5;
          break;
        case "text":
          width = 15; // Default text field size
          height = 5;
          break;
      }

      const newField: SignatureField = {
        id: Math.random().toString(36).substr(2, 9),
        type: signatureDialog.selectedTool,
        x,
        y,
        width,
        height,
        page: signatureDialog.currentPage,
        required: true,
        label: getFieldLabel(signatureDialog.selectedTool),
      };

      setSignatureDialog((prev) => ({
        ...prev,
        fields: [...prev.fields, newField],
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setDraggedField(fieldId);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedField || !pdfContainerRef.current) return;

    const iframe = pdfContainerRef.current.querySelector("iframe");
    if (!iframe) return;

    const iframeRect = iframe.getBoundingClientRect();
    const x = ((e.clientX - iframeRect.left) / iframeRect.width) * 100;
    const y = ((e.clientY - iframeRect.top) / iframeRect.height) * 100;

    setSignatureDialog((prev) => ({
      ...prev,
      fields: prev.fields.map((field) =>
        field.id === draggedField ? { ...field, x, y } : field
      ),
    }));
  };

  const handleMouseUp = () => {
    setDraggedField(null);
    setIsDragging(false);
  };

  const handleFieldDelete = (fieldId: string) => {
    setSignatureDialog((prev) => ({
      ...prev,
      fields: prev.fields.filter((field) => field.id !== fieldId),
    }));
  };

  const getFieldLabel = (type: SignatureField["type"]): string => {
    switch (type) {
      case "signature":
        return "Signature";
      case "name":
        return "Full Name";
      case "date":
        return "Date";
      case "email":
        return "Email";
      case "text":
        return "Text Field";
      default:
        return "Field";
    }
  };

  const saveSignatureFields = async () => {
    if (!signatureDialog.documentId) return;

    try {
      const { error } = await supabase
        .from("documents")
        .update({
          signature_fields: signatureDialog.fields,
          requires_signature: true,
          signature_status: "awaiting_signature",
        })
        .eq("id", signatureDialog.documentId);

      if (error) throw error;

      toast.success("Signature fields saved successfully");
      setSignatureDialog((prev) => ({ ...prev, isOpen: false }));
      fetchDocuments();
    } catch (error) {
      console.error("Error saving signature fields:", error);
      toast.error("Failed to save signature fields");
    }
  };

  const prepareForSignature = async (documentId: string) => {
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) {
      toast.error("Document not found");
      return;
    }
    await openSignatureDialog(doc);
  };

  const getDocumentUrl = async (filePath: string) => {
    try {
      console.log("Getting document URL for path:", filePath);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("Authentication error:", userError);
        return null;
      }

      // Normalize the file path
      const normalizedPath = normalizeFilePath(filePath);
      console.log("Normalized path:", normalizedPath);

      // Try to get a signed URL first (preferred method)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("documents")
        .createSignedUrl(normalizedPath, 3600);

      if (!signedError && signedData?.signedUrl) {
        console.log("Got signed URL");
        // Add PDF viewer prefix to force PDF display
        return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(signedData.signedUrl)}`;
      }

      console.log("Signed URL failed, trying download");

      // If signed URL fails, try to download and create blob URL
      const { data: downloadData, error: downloadError } =
        await supabase.storage.from("documents").download(normalizedPath);

      if (downloadError) {
        throw new Error(
          `Download error: ${downloadError.message || "Unknown error"}`
        );
      }

      if (!downloadData) {
        throw new Error("No data received from download");
      }

      // Create a blob URL from the downloaded data
      const blobUrl = URL.createObjectURL(downloadData);
      console.log("Created blob URL");
      // Add PDF viewer prefix to force PDF display
      return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(blobUrl)}`;
    } catch (error: any) {
      console.error("Error getting document URL:", error);
      toast.error("Error accessing document. Please try again.");
      return null;
    }
  };

  // Update the document viewing button click handler
  const handleViewDocument = async (doc: Document) => {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Unable to access document");
    }
  };

  const revertSignatureStatus = async (doc: Document) => {
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          requires_signature: false,
          signature_status: "pending",
          signature_fields: [],
        })
        .eq("id", doc.id);

      if (error) throw error;

      toast.success("Document signature status reverted");
      await fetchDocuments();
    } catch (error) {
      console.error("Error reverting signature status:", error);
      toast.error("Failed to revert signature status");
    }
  };

  const deleteDocument = async (doc: Document) => {
    try {
      // First, delete the file from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([doc.file_path]);

      if (storageError) {
        console.error("Storage deletion error:", storageError);
        toast.error("Error deleting file from storage");
        return;
      }

      // Then, delete the database record
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      toast.success("Document deleted successfully");
      await fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const sendForSignature = async () => {
    if (!sendSignatureDialog.documentId || !sendSignatureDialog.signerEmail)
      return;

    try {
      const doc = documents.find(
        (d) => d.id === sendSignatureDialog.documentId
      );
      if (!doc?.signature_fields?.length) {
        toast.error("Please prepare the document for signature first");
        return;
      }

      const accessToken =
        Math.random().toString(36).substring(2) + Date.now().toString(36);

      const { error } = await supabase.from("signature_requests").insert({
        document_id: sendSignatureDialog.documentId,
        signer_email: sendSignatureDialog.signerEmail,
        signer_name: sendSignatureDialog.signerName,
        status: "pending",
        access_token: accessToken,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      // Here you would typically send an email to the signer with the signing link
      const signingUrl = `${window.location.origin}/sign/${accessToken}`;
      toast.success("Signature request sent!");
      console.log("Signing URL:", signingUrl);

      setSendSignatureDialog((prev) => ({ ...prev, isOpen: false }));
      fetchDocuments();
    } catch (error: any) {
      console.error("Error sending signature request:", error);
      toast.error(error.message || "Failed to send signature request");
    }
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    fieldId: string,
    direction: string
  ) => {
    e.stopPropagation();
    setResizeField(fieldId);
    setResizeDirection(direction);
    setIsResizing(true);
  };

  const handleResize = (e: React.MouseEvent) => {
    if (
      !isResizing ||
      !resizeField ||
      !resizeDirection ||
      !pdfContainerRef.current
    )
      return;

    const iframe = pdfContainerRef.current.querySelector("iframe");
    if (!iframe) return;

    const iframeRect = iframe.getBoundingClientRect();
    const field = signatureDialog.fields.find((f) => f.id === resizeField);
    if (!field) return;

    const deltaX =
      ((e.clientX - iframeRect.left) / iframeRect.width) * 100 - field.x;
    const deltaY =
      ((e.clientY - iframeRect.top) / iframeRect.height) * 100 - field.y;

    setSignatureDialog((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => {
        if (f.id !== resizeField) return f;

        // Calculate new dimensions while maintaining minimum sizes
        const newWidth = resizeDirection.includes("e")
          ? Math.max(10, Math.min(30, deltaX * 2)) // Min 10%, Max 30%
          : f.width;
        const newHeight = resizeDirection.includes("s")
          ? Math.max(4, Math.min(12, deltaY * 2)) // Min 4%, Max 12%
          : f.height;

        return {
          ...f,
          width: newWidth,
          height: newHeight,
        };
      }),
    }));
  };

  const handleResizeEnd = () => {
    setResizeField(null);
    setResizeDirection(null);
    setIsResizing(false);
  };

  const testSigningExperience = async (doc: Document) => {
    try {
      if (!doc.signature_fields?.length) {
        toast.error("Please prepare the document for signature first");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Authentication error:", userError);
        toast.error("Authentication error");
        return;
      }

      // Generate a temporary access token
      const accessToken =
        Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Create a temporary signature request
      const { data, error } = await supabase
        .from("signature_requests")
        .insert({
          document_id: doc.id,
          signer_email: "test@example.com",
          signer_name: "Test Signer",
          status: "pending",
          access_token: accessToken,
          created_by: user.id,
          signature_data: {}, // Initialize empty signature data
        })
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        toast.error(error.message || "Failed to create test signature request");
        return;
      }

      if (!data) {
        console.error("No data returned from insert");
        toast.error("Failed to create test signature request");
        return;
      }

      // Generate signing URL
      const signingUrl = `${window.location.origin}/sign/${accessToken}`;

      // Open signing page in new tab
      window.open(signingUrl, "_blank");

      toast.success("Test signing page opened in new tab");
    } catch (error: any) {
      console.error("Error creating test signing link:", error);
      toast.error("Failed to create test signing link. Please try again.");
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchDocuments();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label>Category</Label>
              <Select onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
                isDragActive
                  ? "border-primary bg-primary/10"
                  : "border-gray-300"
              }`}
            >
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Drop the files here ...</p>
              ) : (
                <p>Drag & drop files here, or click to select files</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Category Name</Label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  placeholder="Enter category description"
                />
              </div>
              <Button
                onClick={createCategory}
                type="button"
                disabled={!newCategoryName.trim()}
              >
                Create Category
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{doc.name}</h3>
                  <p className="text-sm text-gray-500">Type: {doc.file_type}</p>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                  {doc.requires_signature && (
                    <p className="text-sm text-amber-500">
                      Signature Status: {doc.signature_status}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!doc.requires_signature ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => prepareForSignature(doc.id)}
                      >
                        Prepare for Signature
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSendSignatureDialog({
                              isOpen: true,
                              documentId: doc.id,
                              signerEmail: "",
                              signerName: "",
                            })
                          }
                        >
                          Send for Signature
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testSigningExperience(doc)}
                        >
                          Test Signing
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDocument(doc)}
                    >
                      View Document
                    </Button>
                    {doc.requires_signature && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to revert the signature status?"
                            )
                          ) {
                            revertSignatureStatus(doc);
                          }
                        }}
                        className="text-yellow-600 hover:text-yellow-700"
                      >
                        Revert Status
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (
                          confirm(
                            "Are you sure you want to delete this document? This action cannot be undone."
                          )
                        ) {
                          deleteDocument(doc);
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={signatureDialog.isOpen}
        onOpenChange={(open) =>
          !open && setSignatureDialog((prev) => ({ ...prev, isOpen: false }))
        }
      >
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Prepare Document for Signature</DialogTitle>
          </DialogHeader>

          <div className="flex h-full">
            <div className="w-64 border-r p-4">
              <Tabs defaultValue="fields" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="fields">Fields</TabsTrigger>
                  <TabsTrigger value="signers">Signers</TabsTrigger>
                </TabsList>
                <TabsContent value="fields" className="space-y-2">
                  <Button
                    variant={
                      signatureDialog.selectedTool === "signature"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setSignatureDialog((prev) => ({
                        ...prev,
                        selectedTool: "signature",
                      }))
                    }
                    className="w-full"
                  >
                    Signature
                  </Button>
                  <Button
                    variant={
                      signatureDialog.selectedTool === "name"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setSignatureDialog((prev) => ({
                        ...prev,
                        selectedTool: "name",
                      }))
                    }
                    className="w-full"
                  >
                    Full Name
                  </Button>
                  <Button
                    variant={
                      signatureDialog.selectedTool === "date"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setSignatureDialog((prev) => ({
                        ...prev,
                        selectedTool: "date",
                      }))
                    }
                    className="w-full"
                  >
                    Date
                  </Button>
                  <Button
                    variant={
                      signatureDialog.selectedTool === "email"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setSignatureDialog((prev) => ({
                        ...prev,
                        selectedTool: "email",
                      }))
                    }
                    className="w-full"
                  >
                    Email
                  </Button>
                  <Button
                    variant={
                      signatureDialog.selectedTool === "text"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setSignatureDialog((prev) => ({
                        ...prev,
                        selectedTool: "text",
                      }))
                    }
                    className="w-full"
                  >
                    Text Field
                  </Button>
                </TabsContent>
                <TabsContent value="signers">
                  <div className="space-y-4">
                    <div>
                      <Label>Add Signer</Label>
                      <Input placeholder="Enter email address" />
                      <Button className="w-full mt-2">Add Signer</Button>
                    </div>
                    <div className="border rounded p-2">
                      <h4 className="font-medium">Signers</h4>
                      {/* List of signers will go here */}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex-1 p-4">
              <div
                ref={pdfContainerRef}
                className="relative w-full h-full border rounded overflow-hidden"
                onClick={handleFieldAdd}
                onMouseMove={(e) => {
                  if (isResizing) {
                    handleResize(e);
                  } else if (isDragging) {
                    handleMouseMove(e);
                  }
                }}
                onMouseUp={() => {
                  handleMouseUp();
                  handleResizeEnd();
                }}
                onMouseLeave={() => {
                  handleMouseUp();
                  handleResizeEnd();
                }}
                style={{
                  cursor: isResizing
                    ? "nwse-resize"
                    : isDragging
                      ? "grabbing"
                      : "crosshair",
                }}
              >
                {signatureDialog.pdfUrl && (
                  <iframe
                    src={signatureDialog.pdfUrl}
                    className="w-full h-full"
                    style={{ minHeight: "600px", pointerEvents: "none" }}
                    sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-downloads"
                  />
                )}
                {signatureDialog.fields.map((field) => (
                  <div
                    key={field.id}
                    style={{
                      position: "absolute",
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: `${field.height}%`,
                      transform: "translate(-50%, -50%)",
                      padding: "4px 8px",
                      border: "2px dashed #4f46e5",
                      borderRadius: "4px",
                      backgroundColor: "rgba(79, 70, 229, 0.1)",
                      cursor:
                        isDragging && draggedField === field.id
                          ? "grabbing"
                          : "grab",
                      zIndex:
                        draggedField === field.id || resizeField === field.id
                          ? 51
                          : 50,
                      userSelect: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.75rem",
                      lineHeight: "1",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      boxShadow:
                        draggedField === field.id || resizeField === field.id
                          ? "0 4px 8px rgba(0,0,0,0.2)"
                          : "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                    onMouseDown={(e) => handleMouseDown(e, field.id)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center bg-indigo-100 rounded text-xs">
                      {field.type === "signature" && "✍️"}
                      {field.type === "date" && "📅"}
                      {field.type === "name" && "👤"}
                      {field.type === "email" && "✉️"}
                      {field.type === "text" && "📝"}
                    </span>
                    <span className="truncate">{field.label}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFieldDelete(field.id);
                      }}
                      className="ml-auto flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-100 text-red-500 text-xs"
                    >
                      ×
                    </button>
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
                      style={{
                        background: "transparent",
                        border: "2px solid #4f46e5",
                        borderTop: "none",
                        borderLeft: "none",
                        borderRadius: "0 0 4px 0",
                      }}
                      onMouseDown={(e) => handleResizeStart(e, field.id, "se")}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSignatureDialog((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancel
            </Button>
            <Button onClick={saveSignatureFields}>Save Fields</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sendSignatureDialog.isOpen}
        onOpenChange={(open) =>
          !open &&
          setSendSignatureDialog((prev) => ({ ...prev, isOpen: false }))
        }
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send for Signature</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Signer's Email</Label>
              <Input
                value={sendSignatureDialog.signerEmail}
                onChange={(e) =>
                  setSendSignatureDialog((prev) => ({
                    ...prev,
                    signerEmail: e.target.value,
                  }))
                }
                placeholder="Enter signer's email"
                type="email"
              />
            </div>
            <div className="grid gap-2">
              <Label>Signer's Name</Label>
              <Input
                value={sendSignatureDialog.signerName}
                onChange={(e) =>
                  setSendSignatureDialog((prev) => ({
                    ...prev,
                    signerName: e.target.value,
                  }))
                }
                placeholder="Enter signer's name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSendSignatureDialog((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancel
            </Button>
            <Button onClick={sendForSignature}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
