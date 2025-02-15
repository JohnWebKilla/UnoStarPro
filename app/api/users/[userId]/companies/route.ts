import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: companies, error } = await supabase
      .from("users")
      .select("associated_companies")
      .eq("id", params.id)
      .single();

    if (error) throw error;

    return NextResponse.json(companies);
  } catch (error) {
    console.error("Error fetching user companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch user companies" },
      { status: 500 }
    );
  }
}

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
        associated_companies: body.companies,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user companies:", error);
    return NextResponse.json(
      { error: "Failed to update user companies" },
      { status: 500 }
    );
  }
}
