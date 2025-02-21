"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SigningDialog from "@/app/(protected)/Docs/SigningDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import SignaturePad from "react-signature-canvas";

interface SignatureField {
  id: string;
  type: string;
  x: number;
  y: number;
  page: number;
  required: boolean;
  label: string;
  value?: string;
  width?: number;
  height?: number;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  signature_fields: SignatureField[];
}

interface SignatureRequest {
  id: string;
  document_id: string;
  signer_email: string;
  signer_name: string;
  status: string;
  signature_data: { [key: string]: string };
}

export default function SignPageClient({ token }: { token: string }) {
  const [document, setDocument] = useState<Document | null>(null);
  const [signatureRequest, setSignatureRequest] =
    useState<SignatureRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<SignatureField | null>(
    null
  );
  const [isSigningDialogOpen, setIsSigningDialogOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<{ [key: string]: string }>(
    {}
  );
  const supabase = createClient();
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const signaturePadRef = useRef<SignaturePad>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizeFilePath = (path: string) => {
    // Remove any leading slashes and ensure proper formatting
    return path.replace(/^\/+/, "");
  };

  const ensureSignaturesBucket = async () => {
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

      const signaturesBucket = buckets?.find((b) => b.name === "signatures");

      if (!signaturesBucket) {
        console.log("Signatures bucket not found, creating...");

        // Try to create the bucket
        const { data: newBucket, error: createError } =
          await supabase.storage.createBucket("signatures", {
            public: false,
            allowedMimeTypes: ["image/png"],
            fileSizeLimit: 5242880, // 5MB
          });

        if (createError) {
          console.error("Error creating bucket:", createError);
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }

        // Create storage policy for the signatures bucket
        const { error: policyError } = await supabase.rpc(
          "create_storage_policy",
          {
            bucket_name: "signatures",
            policy_definition: `(role() = 'authenticated' AND (bucket_id = 'signatures' AND (auth.uid() = owner OR EXISTS (
            SELECT 1 FROM signature_requests sr
            WHERE sr.document_id = SPLIT_PART(name, '/', 1)::uuid
              AND sr.created_by = auth.uid()
          ))))`,
          }
        );

        if (policyError) {
          console.error("Error creating storage policy:", policyError);
          throw new Error(
            `Failed to create storage policy: ${policyError.message}`
          );
        }

        console.log("Created new bucket with policy:", newBucket);
        return true;
      }

      console.log("Signatures bucket exists:", signaturesBucket);
      return true;
    } catch (error: any) {
      console.error("Error in ensureSignaturesBucket:", error);
      toast.error(error.message || "Failed to configure storage");
      return false;
    }
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
        // Add PDF viewer prefix and disable toolbar for consistent view
        return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(signedData.signedUrl)}&toolbar=0&zoom=140`;
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
      return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(blobUrl)}&toolbar=0&zoom=140`;
    } catch (error: any) {
      console.error("Error getting document URL:", error);
      toast.error("Error accessing document. Please try again.");
      return null;
    }
  };

  useEffect(() => {
    async function loadSigningData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch signature request using the token
        const { data: requestData, error: requestError } = await supabase
          .from("signature_requests")
          .select("*")
          .eq("access_token", token)
          .single();

        if (requestError) throw new Error("Invalid or expired signing link");
        if (!requestData) throw new Error("Signature request not found");

        setSignatureRequest(requestData);

        // Fetch the associated document
        const { data: documentData, error: documentError } = await supabase
          .from("documents")
          .select("*")
          .eq("id", requestData.document_id)
          .single();

        if (documentError) throw new Error("Could not load document");
        if (!documentData) throw new Error("Document not found");

        setDocument(documentData);

        // Get document URL for viewing
        const url = await getDocumentUrl(documentData.file_path);
        if (!url) throw new Error("Could not load document for viewing");
        setDocumentUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        toast.error(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    loadSigningData();
  }, [token]);

  const handleFieldClick = (field: SignatureField) => {
    if (!signatureData[field.id]) {
      setSelectedField(field);
      setIsSigningDialogOpen(true);
    }
  };

  const handleSignatureComplete = (fieldId: string, value: string) => {
    const newSignatureData = {
      ...signatureData,
      [fieldId]: value,
    };
    setSignatureData(newSignatureData);
    setIsSigningDialogOpen(false);
    setSelectedField(null);

    // Check if all required fields are signed
    const allRequiredFieldsSigned = document?.signature_fields
      .filter((field) => field.required)
      .every((field) => newSignatureData[field.id]);

    if (allRequiredFieldsSigned) {
      handleSign(newSignatureData);
    }
  };

  const handleSign = async (data: { [key: string]: string }) => {
    try {
      if (!signatureRequest?.id || !document?.id) {
        throw new Error("No signature request ID or document ID found");
      }

      console.log("Saving signature data:", {
        requestId: signatureRequest.id,
        documentId: document.id,
        data: data,
      });

      // Store signatures in the signatures bucket
      const signaturePromises = Object.entries(data).map(
        async ([fieldId, value]) => {
          if (!value.startsWith("data:image")) return null;

          const field = document.signature_fields.find((f) => f.id === fieldId);
          if (!field || field.type !== "signature") return null;

          const signaturePath = `${document.id}/${fieldId}.png`;
          const base64Data = value.split(",")[1];
          const binaryData = Buffer.from(base64Data, "base64");
          const blob = new Blob([binaryData], { type: "image/png" });

          // Upload signature image
          const { error: uploadError } = await supabase.storage
            .from("signatures")
            .upload(signaturePath, blob, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error("Upload error details:", uploadError);
            throw new Error(
              `Failed to upload signature: ${uploadError.message}`
            );
          }

          return {
            fieldId,
            path: signaturePath,
            position: {
              x: field.x,
              y: field.y,
              width: field.width,
              height: field.height,
              page: field.page,
            },
          };
        }
      );

      const signatures = (await Promise.all(signaturePromises)).filter(Boolean);

      // Update signature request with signature data
      const { error: signatureError } = await supabase
        .from("signature_requests")
        .update({
          signature_data: {
            ...data,
            signatures: signatures,
          },
          status: "completed",
        })
        .eq("id", signatureRequest.id);

      if (signatureError) {
        throw new Error(
          `Failed to update signature request: ${signatureError.message}`
        );
      }

      // Update document status
      const { error: documentError } = await supabase
        .from("documents")
        .update({
          signature_status: "completed",
          signed_by: signatureRequest.signer_email,
          last_signed_at: new Date().toISOString(),
          signature_data: {
            ...data,
            signatures: signatures,
          },
        })
        .eq("id", document.id);

      if (documentError) {
        throw new Error(`Failed to update document: ${documentError.message}`);
      }

      toast.success("Document signed successfully!");

      // Add a small delay before redirecting
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("Signing error:", errorMessage);
      toast.error(`Failed to save signature: ${errorMessage}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => (window.location.href = "/")}
          >
            Return Home
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!document || !signatureRequest) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle>Document Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The requested document could not be found or has expired.</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => (window.location.href = "/")}
          >
            Return Home
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-800">
            {document.name}
          </h1>
          <span className="text-sm text-gray-500">Please review and sign</span>
        </div>
        <Button
          className="bg-[#2B85FF] hover:bg-[#1a76f2] text-white"
          onClick={() => {
            const allRequiredFieldsSigned = document?.signature_fields
              .filter((field) => field.required)
              .every((field) => signatureData[field.id]);

            if (allRequiredFieldsSigned) {
              handleSign(signatureData);
            } else {
              toast.error("Please complete all required fields");
            }
          }}
        >
          Finish
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          {/* Progress Section */}
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Required Fields
            </h4>
            <div className="space-y-2">
              {document.signature_fields.map((field) => (
                <div
                  key={field.id}
                  className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                    signatureData[field.id]
                      ? "bg-green-50 border border-green-200"
                      : "hover:bg-gray-50 border border-gray-100"
                  }`}
                  onClick={() => handleFieldClick(field)}
                >
                  <div
                    className={`w-4 h-4 rounded-full mr-3 flex-shrink-0 ${
                      signatureData[field.id] ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 font-medium truncate">
                      {field.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {signatureData[field.id] ? "Completed" : "Required"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Instructions
            </h4>
            <ul className="text-xs text-gray-600 space-y-2">
              <li className="flex items-center">
                <span className="w-4 h-4 mr-2 flex-shrink-0 text-[#2B85FF]">
                  •
                </span>
                Click each field on the document
              </li>
              <li className="flex items-center">
                <span className="w-4 h-4 mr-2 flex-shrink-0 text-[#2B85FF]">
                  •
                </span>
                Complete all required fields
              </li>
              <li className="flex items-center">
                <span className="w-4 h-4 mr-2 flex-shrink-0 text-[#2B85FF]">
                  •
                </span>
                Click Finish when you're done
              </li>
            </ul>
          </div>
        </div>

        {/* Main Document View */}
        <div className="flex-1 relative bg-gray-100">
          <div className="absolute inset-0 flex justify-center overflow-auto p-4">
            <div className="w-full max-w-4xl">
              <div
                ref={pdfContainerRef}
                className="bg-white shadow-lg rounded-lg relative"
              >
                {/* PDF Container */}
                <div className="relative" style={{ height: "100%" }}>
                  {documentUrl && (
                    <iframe
                      src={documentUrl}
                      className="w-full border-none"
                      style={{ height: "calc(100vh - 120px)" }}
                      sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-downloads"
                    />
                  )}

                  {/* Signature Field Overlays */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ height: "100%" }}
                  >
                    {document?.signature_fields.map((field) => {
                      const isSigned = signatureData[field.id];
                      return (
                        <div
                          key={field.id}
                          onClick={() => handleFieldClick(field)}
                          style={{
                            position: "absolute",
                            left: `${field.x}%`,
                            top: `${field.y}%`,
                            width: `${field.width || 20}%`,
                            height: `${field.height || 8}%`,
                            padding: "4px",
                            border: "2px dashed",
                            borderColor: isSigned ? "#22c55e" : "#2B85FF",
                            borderRadius: "4px",
                            backgroundColor: isSigned
                              ? "rgba(34, 197, 94, 0.1)"
                              : "rgba(43, 133, 255, 0.1)",
                            cursor: isSigned ? "default" : "pointer",
                            zIndex: 50,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "column",
                            userSelect: "none",
                            pointerEvents: "auto",
                            transform: "translate(-50%, -50%)",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          }}
                        >
                          {isSigned ? (
                            field.type === "signature" ? (
                              <img
                                src={signatureData[field.id]}
                                alt="Signature"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "100%",
                                  objectFit: "contain",
                                  padding: "2px",
                                }}
                              />
                            ) : (
                              <span className="text-sm font-medium truncate w-full text-center">
                                {signatureData[field.id]}
                              </span>
                            )
                          ) : (
                            <>
                              <span className="text-xs text-[#2B85FF] font-medium truncate">
                                {field.label}
                              </span>
                              <span className="text-[10px] text-[#2B85FF]">
                                Click to{" "}
                                {field.type === "signature" ? "sign" : "fill"}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Dialog */}
      {selectedField && (
        <Dialog
          open={isSigningDialogOpen}
          onOpenChange={setIsSigningDialogOpen}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{selectedField.label}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {selectedField.type === "signature" ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-2 bg-white">
                    <SignaturePad
                      ref={signaturePadRef}
                      canvasProps={{
                        className: "signature-pad w-full h-[200px]",
                        style: {
                          width: "100%",
                          height: "200px",
                          backgroundColor: "transparent",
                        },
                      }}
                      backgroundColor="rgba(0,0,0,0)"
                    />
                  </div>
                  <Button
                    onClick={() => signaturePadRef.current?.clear()}
                    variant="outline"
                    type="button"
                    className="w-full"
                  >
                    Clear Signature
                  </Button>
                </div>
              ) : selectedField.type === "date" ? (
                <div className="text-center py-4">
                  <p className="text-lg">{new Date().toLocaleDateString()}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    ref={inputRef}
                    type={selectedField.type === "email" ? "email" : "text"}
                    className="w-full p-2 border rounded"
                    placeholder={`Enter ${selectedField.label.toLowerCase()}`}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsSigningDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#2B85FF] hover:bg-[#1a76f2] text-white"
                onClick={() => {
                  if (
                    selectedField.type === "signature" &&
                    signaturePadRef.current
                  ) {
                    if (!signaturePadRef.current?.toData().length) {
                      toast.error("Please draw your signature first");
                      return;
                    }
                    const canvas = signaturePadRef.current.getCanvas();
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                      const signatureData = ctx.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                      );
                      ctx.fillStyle = "#FFFFFF";
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.putImageData(signatureData, 0, 0);
                      const dataUrl = canvas.toDataURL("image/png");
                      handleSignatureComplete(selectedField.id, dataUrl);
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      ctx.putImageData(signatureData, 0, 0);
                    }
                  } else if (selectedField.type === "date") {
                    handleSignatureComplete(
                      selectedField.id,
                      new Date().toLocaleDateString()
                    );
                  } else {
                    const value = inputRef.current?.value || "";

                    if (!value) {
                      toast.error("Please enter a value");
                      return;
                    }

                    if (
                      selectedField.type === "email" &&
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                    ) {
                      toast.error("Please enter a valid email address");
                      return;
                    }

                    handleSignatureComplete(selectedField.id, value);
                  }
                }}
              >
                Save{" "}
                {selectedField.type === "signature"
                  ? "Signature"
                  : selectedField.type === "date"
                    ? "Date"
                    : selectedField.type === "email"
                      ? "Email"
                      : "Text"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
