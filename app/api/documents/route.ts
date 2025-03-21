import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const driverId = searchParams.get("driverId");

  if (!driverId) {
    return NextResponse.json(
      { error: "Driver ID is required" },
      { status: 400 }
    );
  }

  try {
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

    // Fetch licenses
    const { data: licenses, error: licensesError } = await supabase
      .from("driver_licenses")
      .select("*")
      .eq("driver_id", driverId);

    if (licensesError) {
      console.error("Error fetching licenses:", licensesError);
      return NextResponse.json(
        { error: "Failed to fetch driver licenses" },
        { status: 500 }
      );
    }

    // Fetch medical cards
    const { data: medicalCards, error: medicalCardsError } = await supabase
      .from("medical_cards")
      .select("*")
      .eq("driver_id", driverId);

    if (medicalCardsError) {
      console.error("Error fetching medical cards:", medicalCardsError);
      return NextResponse.json(
        { error: "Failed to fetch medical cards" },
        { status: 500 }
      );
    }

    // Check if mvr_records table exists, otherwise fallback to mvr_files
    let mvrTableName = "mvr_records";
    const { data: tableExists } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_name", "mvr_records")
      .single();

    if (!tableExists) {
      mvrTableName = "mvr_files";
    }

    // Fetch MVR records
    const { data: mvrRecords, error: mvrRecordsError } = await supabase
      .from(mvrTableName)
      .select("*")
      .eq("driver_id", driverId);

    if (mvrRecordsError) {
      console.error("Error fetching MVR records:", mvrRecordsError);
      return NextResponse.json(
        { error: "Failed to fetch MVR records" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      license: licenses,
      medical_card: medicalCards,
      mvr: mvrRecords,
    });
  } catch (error) {
    console.error("Error in documents GET API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const { documentType, driverId, document } = body;

    if (!documentType || !driverId || !document) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let tableName = "";
    if (documentType === "license") {
      tableName = "driver_licenses";
    } else if (documentType === "medical_card") {
      tableName = "medical_cards";
    } else if (documentType === "mvr") {
      tableName = "mvr_records";
    } else {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from(tableName)
      .insert({
        ...document,
        driver_id: driverId,
      })
      .select();

    if (error) {
      console.error("Error inserting document:", error);
      return NextResponse.json(
        { error: "Failed to save document" },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error("Error in documents POST API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
