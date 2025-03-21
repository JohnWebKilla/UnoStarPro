import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";

// Define the document types and their corresponding table names
const DOCUMENT_TABLES = {
  license: "driver_licenses",
  medical_card: "medical_cards",
  mvr: "mvr_files",
} as const;

type DocumentType = keyof typeof DOCUMENT_TABLES;

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = await createClient();

    // Get user session using getUser instead of getSession for security
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error:", authError);
      return new NextResponse(`Authentication failed: ${authError.message}`, {
        status: 401,
      });
    }

    if (!user) {
      return new NextResponse("No active session found", { status: 401 });
    }

    const userId = user.id;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const driverId = formData.get("driverId") as string;
    const driverName = formData.get("driverName") as string;
    const documentType = formData.get("documentType") as DocumentType;
    const expirationDate = formData.get("expirationDate") as string;

    // Validate required fields
    const missingFields = [];
    if (!file) missingFields.push("file");
    if (!driverId) missingFields.push("driverId");
    if (!driverName) missingFields.push("driverName");
    if (!documentType) missingFields.push("documentType");
    if (!expirationDate) missingFields.push("expirationDate");

    if (missingFields.length > 0) {
      return new NextResponse(
        `Missing required fields: ${missingFields.join(", ")}`,
        { status: 400 }
      );
    }

    // Validate document type
    if (!Object.keys(DOCUMENT_TABLES).includes(documentType)) {
      return new NextResponse(`Invalid document type: ${documentType}`, {
        status: 400,
      });
    }

    // Create a sanitized folder name
    const sanitizedDriverName = driverName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
    const driverFolderId = uuidv4().split("-")[0];
    const folderPrefix = `drivers/${sanitizedDriverName}_${driverFolderId}/${documentType}`;

    // Generate a unique filename
    const fileExtension = file.name.split(".").pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const key = `${folderPrefix}/${uniqueFilename}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(key, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new NextResponse(`Failed to upload file: ${uploadError.message}`, {
        status: 500,
      });
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(key);

    // Prepare the document record based on type
    const baseRecord = {
      driver_id: parseInt(driverId),
      expiration_date: new Date(expirationDate).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add the file URL with the correct column name based on document type
    const documentRecord = {
      ...baseRecord,
      ...(documentType === "license" && { license_file_url: publicUrl }),
      ...(documentType === "medical_card" && { file_link: publicUrl }),
      ...(documentType === "mvr" && { mvr_file_url: publicUrl }),
    };

    console.log("Attempting to insert document record:", {
      table: DOCUMENT_TABLES[documentType],
      record: documentRecord,
    });

    // Save document record in the appropriate table
    const { data: document, error: dbError } = await supabase
      .from(DOCUMENT_TABLES[documentType])
      .insert(documentRecord)
      .select()
      .single();

    if (dbError) {
      console.error("Database error details:", {
        table: DOCUMENT_TABLES[documentType],
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
      });
      // If DB insert fails, try to clean up the uploaded file
      await supabase.storage.from("documents").remove([key]);
      return new NextResponse(
        `Failed to save document record: ${dbError.message}`,
        { status: 500 }
      );
    }

    if (!document) {
      await supabase.storage.from("documents").remove([key]);
      return new NextResponse("Failed to create document record", {
        status: 500,
      });
    }

    // Get the URL from the correct field based on document type
    const documentUrl =
      document[
        documentType === "license"
          ? "license_file_url"
          : documentType === "medical_card"
            ? "file_link"
            : "mvr_file_url"
      ];

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        url: documentUrl,
        expiration_date: document.expiration_date,
        type: documentType,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return new NextResponse(
      `Internal Server Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
