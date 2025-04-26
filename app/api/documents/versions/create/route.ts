import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Parse form data with file upload
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const documentId = formData.get("documentId") as string;
    const documentType = formData.get("documentType") as string;
    const versionName = formData.get("versionName") as string;

    if (!file || !documentId || !documentType) {
      return NextResponse.json(
        { error: "File, document ID, and document type are required" },
        { status: 400 }
      );
    }

    // Query the appropriate table based on document type
    let driverId: string | null = null;
    const validTypes = ["license", "medical_card", "mvr"];

    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    // Map document type to table name
    const tableMap: Record<string, string> = {
      license: "licenses",
      medical_card: "medical_cards",
      mvr: "mvr_files",
    };

    const tableName = tableMap[documentType];

    // Get document info from the appropriate table
    const { data: document, error: docError } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error(`Error fetching ${documentType}:`, docError);
      return NextResponse.json(
        { error: `${documentType} not found` },
        { status: 404 }
      );
    }

    // Get driver ID based on the document type
    if (documentType === "license") {
      driverId = document.driver_id;
    } else if (documentType === "medical_card") {
      driverId = document.driver_id;
    } else if (documentType === "mvr") {
      driverId = document.driver_id;
    }

    if (!driverId) {
      return NextResponse.json(
        { error: "Driver ID not found for document" },
        { status: 400 }
      );
    }

    // Create file path
    const timestamp = Date.now();
    const filePath = `drivers/${driverId}/${documentType}/${documentId}_version_${timestamp}.jpg`;

    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/jpeg",
      });

    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get the public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(filePath);

    // Create a new version record in the database
    const { data: versionData, error: versionError } = await supabase
      .from("document_versions")
      .insert({
        document_id: documentId,
        document_type: documentType,
        file_path: filePath,
        file_url: publicUrl,
        version_name: versionName || `Version ${timestamp}`,
        created_at: new Date().toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (versionError) {
      console.error("Error creating version record:", versionError);
      return NextResponse.json(
        { error: "Failed to create version record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: versionData.id,
      url: publicUrl,
      message: "Version created successfully",
    });
  } catch (error) {
    console.error("Unexpected error in version create API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
