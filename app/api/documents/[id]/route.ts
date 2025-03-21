import { NextRequest, NextResponse } from "next/server";
import { withAuth, createClient } from "@/utils/supabase/server";
import { Session } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

// Get details for a specific document
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const documentType = request.nextUrl.searchParams.get("type");

  if (!documentType) {
    return NextResponse.json(
      { error: "Document type is required" },
      { status: 400 }
    );
  }

  if (!["license", "medical", "mvr"].includes(documentType)) {
    return NextResponse.json(
      { error: "Invalid document type" },
      { status: 400 }
    );
  }

  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
      let tableName = "";
      let selectColumns = "*";

      if (documentType === "license") {
        tableName = "driver_licenses";
      } else if (documentType === "medical") {
        tableName = "medical_cards";
      } else if (documentType === "mvr") {
        tableName = "mvr_records";
      }

      const { data, error } = await supabase
        .from(tableName)
        .select(selectColumns)
        .eq("id", id)
        .single();

      if (error) {
        console.error(`Error fetching ${documentType} document:`, error);
        return NextResponse.json(
          { error: `Failed to fetch ${documentType} document` },
          { status: error.code === "PGRST116" ? 404 : 500 }
        );
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error(`Error in ${documentType} document GET API:`, error);
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  });
}

// Update a document
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const documentType = request.nextUrl.searchParams.get("type");

  if (!documentType) {
    return NextResponse.json(
      { error: "Document type is required" },
      { status: 400 }
    );
  }

  if (!["license", "medical", "mvr"].includes(documentType)) {
    return NextResponse.json(
      { error: "Invalid document type" },
      { status: 400 }
    );
  }

  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
      const updateData = await request.json();

      let tableName = "";
      if (documentType === "license") {
        tableName = "driver_licenses";
      } else if (documentType === "medical") {
        tableName = "medical_cards";
      } else if (documentType === "mvr") {
        tableName = "mvr_records";
      }

      const { data, error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", id)
        .select();

      if (error) {
        console.error(`Error updating ${documentType} document:`, error);
        return NextResponse.json(
          { error: `Failed to update ${documentType} document` },
          { status: 500 }
        );
      }

      return NextResponse.json(data[0] || {});
    } catch (error) {
      console.error(`Error in ${documentType} document PATCH API:`, error);
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  });
}

// Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const documentType = request.nextUrl.searchParams.get("type");

  if (!documentType) {
    return NextResponse.json(
      { error: "Document type is required" },
      { status: 400 }
    );
  }

  if (!["license", "medical", "mvr"].includes(documentType)) {
    return NextResponse.json(
      { error: "Invalid document type" },
      { status: 400 }
    );
  }

  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
      let tableName = "";
      let fileUrlColumn = "";

      if (documentType === "license") {
        tableName = "driver_licenses";
        fileUrlColumn = "license_file_url";
      } else if (documentType === "medical") {
        tableName = "medical_cards";
        fileUrlColumn = "file_link";
      } else if (documentType === "mvr") {
        tableName = "mvr_records";
        fileUrlColumn = "mvr_file_url";
      }

      // First, get the document to find the file URL
      const { data: documentData, error: getError } = await supabase
        .from(tableName)
        .select(fileUrlColumn)
        .eq("id", id)
        .single();

      if (getError) {
        console.error(`Error fetching ${documentType} document:`, getError);
        return NextResponse.json(
          { error: `Failed to fetch ${documentType} document` },
          { status: getError.code === "PGRST116" ? 404 : 500 }
        );
      }

      // Delete the document record
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error(`Error deleting ${documentType} document:`, deleteError);
        return NextResponse.json(
          { error: `Failed to delete ${documentType} document` },
          { status: 500 }
        );
      }

      // If we have a file URL, try to delete the file from storage
      const fileUrl = documentData
        ? documentData[fileUrlColumn as keyof typeof documentData]
        : null;
      if (fileUrl) {
        try {
          // Extract the path from the URL
          const url = new URL(fileUrl as string);
          const pathWithBucket = url.pathname;
          // Remove the bucket name and initial slash from the path
          // Format is typically /bucket-name/path/to/file
          const filePath = pathWithBucket.split("/").slice(2).join("/");

          if (filePath) {
            const { error: storageError } = await supabase.storage
              .from("documents")
              .remove([filePath]);

            if (storageError) {
              console.warn(
                `Failed to delete file from storage: ${storageError.message}`
              );
              // We don't return an error here as the document record was deleted successfully
            }
          }
        } catch (error) {
          console.warn("Error parsing file URL or deleting file:", error);
          // We don't return an error here as the document record was deleted successfully
        }
      }

      return NextResponse.json({ success: true, id });
    } catch (error) {
      console.error(`Error in ${documentType} document DELETE API:`, error);
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  });
}
