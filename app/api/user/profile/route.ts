import { NextResponse } from "next/server";
import { withAuth, createClient } from "@/utils/supabase/server";
import { Session } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export async function GET() {
  return withAuth(async (supabase: SupabaseClient<any>, session: Session) => {
    try {
      const userId = session.user.id;

      // Get the user's profile with company_id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError);
        return NextResponse.json(
          { error: "Failed to fetch profile data" },
          { status: 500 }
        );
      }

      // Return the profile data
      return NextResponse.json(profileData || { company_id: null });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  });
}
