"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SigningDialog from "@/app/(protected)/Docs/SigningDialog";

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
  const supabase = createClient();

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        toast.error(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    loadSigningData();
  }, [token]);

  const handleSign = async (signatureData: { [key: string]: string }) => {
    try {
      const { error } = await supabase
        .from("signature_requests")
        .update({
          status: "completed",
          signature_data: signatureData,
          completed_at: new Date().toISOString(),
        })
        .eq("id", signatureRequest?.id);

      if (error) throw error;
      toast.success("Document signed successfully!");
    } catch (err) {
      toast.error("Failed to save signature");
      console.error("Signing error:", err);
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
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Sign Document: {document.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <SigningDialog
            document={document}
            onSign={handleSign}
            signerEmail={signatureRequest.signer_email}
            signerName={signatureRequest.signer_name}
          />
        </CardContent>
      </Card>
    </div>
  );
}
