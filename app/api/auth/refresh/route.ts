import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const supabase = await createClient();

    // Attempt to refresh the session
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();

    if (error || !session) {
      console.error("Failed to refresh session:", error);
      return new NextResponse(null, { status: 401 });
    }

    // Return the new session data
    return new NextResponse(
      JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          expires_at: session.expires_at,
          refresh_token: session.refresh_token,
          user: session.user,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in refresh endpoint:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500 }
    );
  }
}
