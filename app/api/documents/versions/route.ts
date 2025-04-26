import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");
    const documentType = searchParams.get("documentType");

    if (!documentId || !documentType) {
      return NextResponse.json(
        { error: "Document ID and document type are required" },
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

    // Query document versions
    const { data: versions, error } = await supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", documentId)
      .eq("document_type", documentType)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching document versions:", error);
      return NextResponse.json(
        { error: "Failed to fetch document versions" },
        { status: 500 }
      );
    }

    // Format the response
    const formattedVersions = versions.map((version) => ({
      id: version.id,
      url: version.file_url,
      timestamp: version.created_at,
      name: version.version_name || `Version ${version.id}`,
      isActive: version.is_active,
    }));

    return NextResponse.json({ versions: formattedVersions });
  } catch (error) {
    console.error("Unexpected error in versions API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
