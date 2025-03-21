import { NextRequest, NextResponse } from "next/server";
import { withAuth, createClient } from "@/utils/supabase/server";
import { Session } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const driverId = searchParams.get("driverId");

  if (!driverId) {
    return NextResponse.json(
      { error: "Driver ID is required" },
      { status: 400 }
    );
  }

  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
      // Fetch licenses
      const { data: licenses, error: licensesError } = await supabase
        .from("driver_licenses")
        .select("*")
        .eq("driver_id", driverId);

      if (licensesError) {
        console.error("Error fetching licenses:", licensesError);
        return NextResponse.json(
          { error: "Failed to fetch license documents" },
          { status: 500 }
        );
      }

      // Fetch medical cards
      const { data: medicalCards, error: medicalError } = await supabase
        .from("medical_cards")
        .select("*")
        .eq("driver_id", driverId);

      if (medicalError) {
        console.error("Error fetching medical cards:", medicalError);
        return NextResponse.json(
          { error: "Failed to fetch medical card documents" },
          { status: 500 }
        );
      }

      // Fetch MVR files
      const { data: mvrFiles, error: mvrError } = await supabase
        .from("mvr_records")
        .select("*")
        .eq("driver_id", driverId);

      if (mvrError) {
        console.error("Error fetching MVR files:", mvrError);
        return NextResponse.json(
          { error: "Failed to fetch MVR documents" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        licenses: licenses || [],
        medicalCards: medicalCards || [],
        mvrFiles: mvrFiles || [],
      });
    } catch (error) {
      console.error("Error in documents GET API:", error);
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
      // Process the form data
      const formData = await request.formData();
      const driverId = formData.get("driverId") as string;
      const type = formData.get("type") as string;
      const file = formData.get("file") as File;
      const expirationDate = formData.get("expirationDate") as string;

      if (!driverId || !type || !file) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Validate document type
      if (!["license", "medical", "mvr"].includes(type)) {
        return NextResponse.json(
          { error: "Invalid document type" },
          { status: 400 }
        );
      }

      // Generate a unique file name
      const fileName = `${type}_${driverId}_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const filePath = `driver-documents/${type}/${fileName}`;

      // Upload file to storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (storageError) {
        console.error("Error uploading file:", storageError);
        return NextResponse.json(
          { error: "Failed to upload document file" },
          { status: 500 }
        );
      }

      // Get the public URL for the uploaded file
      const { data: publicUrlData } = await supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // Add document record to the appropriate table
      let insertResult;
      if (type === "license") {
        insertResult = await supabase.from("driver_licenses").insert({
          driver_id: driverId,
          license_file_url: fileUrl,
          expiration_date: expirationDate || null,
        });
      } else if (type === "medical") {
        insertResult = await supabase.from("medical_cards").insert({
          driver_id: driverId,
          file_link: fileUrl,
          expiration_date: expirationDate || null,
        });
      } else if (type === "mvr") {
        insertResult = await supabase.from("mvr_records").insert({
          driver_id: driverId,
          mvr_file_url: fileUrl,
          expiration_date: expirationDate || null,
        });
      }

      if (insertResult && insertResult.error) {
        console.error("Error inserting document record:", insertResult.error);

        // Try to delete the uploaded file as cleanup
        await supabase.storage.from("documents").remove([filePath]);

        return NextResponse.json(
          { error: "Failed to create document record" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Document uploaded successfully",
        fileUrl,
      });
    } catch (error) {
      console.error("Error in documents POST API:", error);
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  });
}
