import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Define the document types and their corresponding table names
const DOCUMENT_TABLES = {
  license: "driver_licenses",
  medical_card: "medical_cards",
  mvr: "mvr_files",
} as const;

type DocumentType = keyof typeof DOCUMENT_TABLES;

export async function DELETE(
  req: Request,
  { params }: { params: { docType: string; id: string } }
) {
  try {
    console.log("Delete document API called with params:", params);

    // Create Supabase client
    const supabase = await createClient();

    // Verify that we have a valid document type
    const docType = params.docType as DocumentType;

    if (!DOCUMENT_TABLES[docType]) {
      return NextResponse.json(
        { error: `Invalid document type: ${docType}` },
        { status: 400 }
      );
    }

    const id = params.id;

    // First, fetch the document to get the file path
    const { data: documentData, error: fetchError } = await supabase
      .from(DOCUMENT_TABLES[docType])
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error(`Error fetching ${docType} document:`, fetchError);
      return NextResponse.json(
        {
          error: `Document not found or you don't have permission to delete it`,
        },
        { status: fetchError.code === "PGRST116" ? 404 : 403 }
      );
    }

    if (!documentData) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete the document from the database
    const { error: deleteError } = await supabase
      .from(DOCUMENT_TABLES[docType])
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(`Error deleting ${docType} document:`, deleteError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    // Try to delete from storage if a storage path exists
    let storageError = null;
    const filePath = documentData.file_path || documentData.storage_path;

    if (filePath) {
      const { error: storageDeleteError } = await supabase.storage
        .from("documents")
        .remove([filePath]);

      if (storageDeleteError) {
        console.warn("Failed to delete file from storage:", storageDeleteError);
        storageError = storageDeleteError;
      }
    }

    return NextResponse.json({
      success: true,
      documentId: id,
      documentType: docType,
      storageError: storageError ? storageError.message : null,
    });
  } catch (error) {
    console.error("Error in document DELETE API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
