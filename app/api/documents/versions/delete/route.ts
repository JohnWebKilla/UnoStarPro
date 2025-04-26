import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { versionId, documentId, documentType } = await request.json();

    if (!versionId || !documentId || !documentType) {
      return NextResponse.json(
        { error: "Version ID, document ID, and document type are required" },
        { status: 400 }
      );
    }

    // Validate document type
    const validTypes = ["license", "medical_card", "mvr"];
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    // Get the version record to find the file path
    const { data: version, error: versionError } = await supabase
      .from("document_versions")
      .select("*")
      .eq("id", versionId)
      .eq("document_id", documentId)
      .eq("document_type", documentType)
      .single();

    if (versionError || !version) {
      console.error("Error fetching version:", versionError);
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Delete the file from storage if file path exists
    if (version.file_path) {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([version.file_path]);

      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
        // Continue anyway to delete the database record
      }
    }

    // Delete the version record from the database
    const { error: deleteError } = await supabase
      .from("document_versions")
      .delete()
      .eq("id", versionId);

    if (deleteError) {
      console.error("Error deleting version record:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete version record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Version deleted successfully",
    });
  } catch (error) {
    console.error("Unexpected error in version delete API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
