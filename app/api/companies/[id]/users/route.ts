import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(request: Request) {
  // Extract ID from URL path with a more reliable approach
  const url = new URL(request.url);
  const companyId = url.pathname.split("/").filter(Boolean)[2];

  try {
    console.log(`API: Fetching users for company ${companyId}`);
    const supabase = await createClient();

    // Get users from user_companies junction table
    console.log(`API: Querying user_companies for company ${companyId}`);
    const { data: userCompanies, error: junctionError } = await supabase
      .from("user_companies")
      .select("user_id")
      .eq("company_id", companyId);

    if (junctionError) {
      console.error(`API error from user_companies: ${junctionError.message}`);
      return NextResponse.json(
        { error: junctionError.message },
        { status: 500 }
      );
    }

    console.log(`API: Found ${userCompanies?.length || 0} user associations`);

    if (!userCompanies || userCompanies.length === 0) {
      console.log(`API: No users found for company ${companyId}`);
      return NextResponse.json({ users: [] });
    }

    // Get user details
    const userIds = userCompanies.map((uc) => uc.user_id);
    console.log(`API: Fetching ${userIds.length} users: ${userIds.join(", ")}`);

    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        role,
        status,
        created_at
      `
      )
      .in("id", userIds);

    if (error) {
      console.error(`API error fetching users: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`API: Retrieved ${users?.length || 0} users successfully`);
    return NextResponse.json({ users });
  } catch (err) {
    console.error("API unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// To add users for testing - uncomment and use this endpoint
export async function POST(request: Request) {
  // Extract ID from URL path with a more reliable approach
  const url = new URL(request.url);
  const companyId = url.pathname.split("/").filter(Boolean)[2];

  try {
    console.log(`API: Adding test user for company ${companyId}`);
    const supabase = await createClient();

    // Create a test user
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        email: `test-user-${Date.now()}@example.com`,
        role: "user",
        status: "active",
        first_name: "Test",
        last_name: "User",
      })
      .select()
      .single();

    if (userError) {
      console.error(`API error creating test user: ${userError.message}`);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Associate user with company
    const { error: associationError } = await supabase
      .from("user_companies")
      .insert({
        user_id: user.id,
        company_id: companyId,
      });

    if (associationError) {
      console.error(`API error associating user: ${associationError.message}`);
      return NextResponse.json(
        { error: associationError.message },
        { status: 500 }
      );
    }

    console.log(
      `API: Successfully added test user ${user.id} to company ${companyId}`
    );

    // Revalidate the relevant paths to update the UI
    revalidatePath(`/Companies/${companyId}`);
    revalidatePath("/Companies");

    return NextResponse.json({
      success: true,
      user,
      message: `User ${user.email} added to company ${companyId}`,
    });
  } catch (err) {
    console.error("API unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
