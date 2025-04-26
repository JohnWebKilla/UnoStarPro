import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// Define document types
interface LicenseDocument {
  id: number;
  driver_id: number;
  license_file_url: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

interface MedicalDocument {
  id: number;
  driver_id: number;
  file_link: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

interface MvrDocument {
  id: number;
  driver_id: number;
  mvr_file_url: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

// Mock data
const mockLicenses: LicenseDocument[] = [
  {
    id: 1,
    driver_id: 1,
    license_file_url: "https://example.com/licenses/license1.pdf",
    expiration_date: "2024-12-31",
    created_at: "2023-01-15T00:00:00Z",
    updated_at: "2023-01-15T00:00:00Z",
  },
  {
    id: 2,
    driver_id: 2,
    license_file_url: "https://example.com/licenses/license2.pdf",
    expiration_date: "2024-10-15",
    created_at: "2023-02-10T00:00:00Z",
    updated_at: "2023-02-10T00:00:00Z",
  },
];

const mockMedicalCards: MedicalDocument[] = [
  {
    id: 1,
    driver_id: 1,
    file_link: "https://example.com/medical/card1.pdf",
    expiration_date: "2024-06-30",
    created_at: "2023-01-20T00:00:00Z",
    updated_at: "2023-01-20T00:00:00Z",
  },
];

const mockMvrFiles: MvrDocument[] = [
  {
    id: 1,
    driver_id: 1,
    mvr_file_url: "https://example.com/mvr/file1.pdf",
    expiration_date: null,
    created_at: "2023-01-25T00:00:00Z",
    updated_at: "2023-01-25T00:00:00Z",
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");

    if (!driverId) {
      return NextResponse.json(
        { error: "Driver ID is required" },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabase = await createClient();

    // Get driver's licenses
    const { data: licenses, error: licensesError } = await supabase
      .from("driver_licenses")
      .select("*")
      .eq("driver_id", parseInt(driverId));

    if (licensesError) {
      console.error("Error fetching licenses:", licensesError);
      return NextResponse.json(
        { error: "Failed to fetch licenses" },
        { status: 500 }
      );
    }

    // Get driver's medical cards
    const { data: medicalCards, error: medicalError } = await supabase
      .from("medical_cards")
      .select("*")
      .eq("driver_id", parseInt(driverId));

    if (medicalError) {
      console.error("Error fetching medical cards:", medicalError);
      return NextResponse.json(
        { error: "Failed to fetch medical cards" },
        { status: 500 }
      );
    }

    // Get driver's MVR files
    const { data: mvrFiles, error: mvrError } = await supabase
      .from("mvr_files")
      .select("*")
      .eq("driver_id", parseInt(driverId));

    if (mvrError) {
      console.error("Error fetching MVR files:", mvrError);
      return NextResponse.json(
        { error: "Failed to fetch MVR files" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      licenses: licenses || [],
      medicalCards: medicalCards || [],
      mvrFiles: mvrFiles || [],
    });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Redirect to the dedicated upload endpoint
  return NextResponse.redirect(
    new URL("/api/documents/upload", request.url),
    308
  );
}

export async function DELETE(request: NextRequest) {
  // Redirect to the dedicated delete endpoint
  return NextResponse.redirect(
    new URL("/api/documents/delete", request.url),
    308
  );
}
