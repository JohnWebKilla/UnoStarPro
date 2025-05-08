import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  clearDriverCache,
  clearDriverListCache,
} from "@/app/(protected)/Drivers/cache";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Properly await the params object
    const { id } = await params;

    // Fetch the driver with associated documents and company information
    const { data, error } = await supabase
      .from("drivers")
      .select(
        `
        *,
        companies:company_id (
          id,
          name
        ),
        driver_licenses(*),
        medical_cards(*),
        mvr_files(*)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching driver:", error);
      return NextResponse.json(
        { error: "Failed to fetch driver" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Transform the response to include company_name
    const transformedData = {
      ...data,
      company_name: data.companies?.name || "N/A",
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("Error in driver GET route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Properly await the params object
    const { id } = await params;
    const updateData = await request.json();

    const { data, error } = await supabase
      .from("drivers")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        companies:company_id (
          id,
          name
        ),
        driver_licenses(*),
        medical_cards(*),
        mvr_files(*)
      `
      )
      .single();

    if (error) {
      console.error("Error updating driver:", error);
      return NextResponse.json(
        { error: "Failed to update driver" },
        { status: 500 }
      );
    }

    // Clear both the specific driver's cache and the list cache
    await clearDriverCache(parseInt(id));
    await clearDriverListCache();

    // Transform the response to include company_name
    const transformedData = {
      ...data,
      company_name: data.companies?.name || "N/A",
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error("Error in driver PATCH route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Properly await the params object
    const { id } = await params;

    // First, get the driver details before deletion to preserve name
    const { data: driverToDelete } = await supabase
      .from("drivers")
      .select("name, id")
      .eq("id", id)
      .single();

    const driverName = driverToDelete?.name || "Unknown driver";

    // Delete the driver
    const { error } = await supabase.from("drivers").delete().eq("id", id);

    if (error) {
      console.error("Error deleting driver:", error);
      return NextResponse.json(
        { error: "Failed to delete driver" },
        { status: 500 }
      );
    }

    // Clear both the specific driver's cache and the list cache
    await clearDriverCache(parseInt(id));
    await clearDriverListCache();

    return NextResponse.json({
      success: true,
      id,
      deletedDriverName: driverName,
    });
  } catch (error) {
    console.error("Error in driver DELETE route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
