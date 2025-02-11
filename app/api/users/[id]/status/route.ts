import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const body = await request.json();

    const { data: user, error } = await supabase
      .from("users")
      .update({
        status: body.status,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user status:", error);
    return NextResponse.json(
      { error: "Failed to update user status" },
      { status: 500 }
    );
  }
}
