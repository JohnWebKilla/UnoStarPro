import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// Define allowed document types
type DocumentType = "license" | "medical_card" | "mvr";

// Define table name mapping with proper types
const DOCUMENT_TABLES: Record<DocumentType, string> = {
  license: "driver_licenses",
  medical_card: "medical_cards",
  mvr: "mvr_files",
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = await createClient();

    // First check if the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate document type
    if (!["license", "medical_card", "mvr"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    // Now type is validated, we can use it as a key
    const documentType = type as DocumentType;

    // Get the document to find its storage path
    const { data: document, error: fetchError } = await supabase
      .from(DOCUMENT_TABLES[documentType])
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("Error fetching document:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch document" },
        { status: 500 }
      );
    }

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get the file URL based on document type
    const fileUrl =
      documentType === "license"
        ? document.license_file_url
        : documentType === "medical_card"
          ? document.file_link
          : document.mvr_file_url;

    if (fileUrl) {
      // Extract the storage path from the URL
      const storagePathMatch = fileUrl.match(/\/documents\/(.+)$/);
      if (storagePathMatch) {
        const storagePath = storagePathMatch[1];
        // Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove([storagePath]);

        if (storageError) {
          console.error("Error deleting file from storage:", storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }
    }

    // Delete the document record
    const { error } = await supabase
      .from(DOCUMENT_TABLES[documentType])
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting document:", error);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error in document delete API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
