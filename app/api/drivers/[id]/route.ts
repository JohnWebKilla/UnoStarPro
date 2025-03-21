import { NextRequest, NextResponse } from "next/server";
import { withAuth, createClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { Session } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
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
        console.error("Error fetching driver:", error);
        return NextResponse.json(
          { error: "Failed to fetch driver details" },
          { status: error.code === "PGRST116" ? 404 : 500 }
        );
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error("Error in driver GET API:", error);
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
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
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
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
  });
}
