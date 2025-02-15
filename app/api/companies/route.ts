import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET - fetch companies (with optional userId filter for user's companies)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const companyId = searchParams.get("companyId");
    const supabase = await createClient();

    // If companyId is provided, fetch specific company
    if (companyId) {
      const { data: company, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (error) {
        return Response.json({ error: "Company not found" }, { status: 404 });
      }

      return Response.json(company);
    }

    // If userId is provided, fetch user's companies
    if (userId) {
      // First get user's access level
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("has_all_access, role")
        .eq("id", userId)
        .single();

      if (userError) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      // If user has all access, return all active companies
      if (user.has_all_access) {
        const { data: companies, error: companiesError } = await supabase
          .from("companies")
          .select("*")
          .eq("status", "active")
          .order("name");

        if (companiesError) throw companiesError;
        return Response.json({ companies, single: false });
      }

      // Get user's assigned companies from junction table
      const { data: userCompanies, error: userCompaniesError } = await supabase
        .from("user_companies")
        .select("companies(*)")
        .eq("user_id", userId)
        .eq("companies.status", "active");

      if (userCompaniesError) throw userCompaniesError;

      const companies = userCompanies
        .map((uc: any) => uc.companies)
        .filter((company) => company !== null);

      return Response.json({ companies, single: false });
    }

    // Otherwise, fetch all companies
    const { data: companies, error } = await supabase
      .from("companies")
      .select("*")
      .order("name");

    if (error) throw error;

    return Response.json(companies);
  } catch (error: any) {
    console.error("Error fetching companies:", error);
    return Response.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

// POST - create new company
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: company, error } = await supabase
      .from("companies")
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return Response.json(company);
  } catch (error: any) {
    console.error("Error creating company:", error);
    return Response.json(
      { error: "Failed to create company" },
      { status: 500 }
    );
  }
}

// PUT - update company
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return Response.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const body = await request.json();

    const { data: company, error } = await supabase
      .from("companies")
      .update(body)
      .eq("id", companyId)
      .select()
      .single();

    if (error) throw error;

    return Response.json(company);
  } catch (error) {
    console.error("Error updating company:", error);
    return Response.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}

// DELETE - delete company
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return Response.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", companyId);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting company:", error);
    return Response.json(
      { error: "Failed to delete company" },
      { status: 500 }
    );
  }
}
