import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: user, error } = await supabase
      .from("users")
      .update({
        first_name: body.first_name,
        last_name: body.last_name,
        phone_number: body.phone_number,
        role: body.role,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
