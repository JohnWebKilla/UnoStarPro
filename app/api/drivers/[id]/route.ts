import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { Session } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

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

    // Fetch the driver with associated documents
    const { data, error } = await supabase
      .from("drivers")
      .select(
        `
        *,
        driver_licenses(*),
        medical_cards(*),
        mvr_records(*)
        `
      )
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Error fetching driver: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in driver GET route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

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

    const updateData = await request.json();

    const { data, error } = await supabase
      .from("drivers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating driver:", error);
      return NextResponse.json(
        { error: "Failed to update driver" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in driver PATCH API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

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

    // Delete the driver
    const { error } = await supabase.from("drivers").delete().eq("id", id);

    if (error) {
      console.error("Error deleting driver:", error);
      return NextResponse.json(
        { error: "Failed to delete driver" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error in driver DELETE API:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
