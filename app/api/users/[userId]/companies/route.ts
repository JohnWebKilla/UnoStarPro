import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("has_all_access, role")
      .eq("id", params.userId)
      .single();

    if (userError) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If user has all access, return all active companies
    if (user.has_all_access) {
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (companiesError) throw companiesError;
      return NextResponse.json({ companies, single: false });
    }

    // Get user's assigned companies from junction table
    const { data: userCompanies, error: userCompaniesError } = await supabase
      .from("user_companies")
      .select("companies(*)")
      .eq("user_id", params.userId)
      .eq("companies.status", "active");

    if (userCompaniesError) throw userCompaniesError;

    const companies = userCompanies
      .map((uc: any) => uc.companies)
      .filter((company) => company !== null);

    return NextResponse.json({ companies, single: false });
  } catch (error: any) {
    console.error("Error getting user companies:", error);
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
