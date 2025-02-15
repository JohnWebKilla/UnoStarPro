import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: user, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          first_name: body.first_name,
          last_name: body.last_name,
          phone_number: body.phone_number,
          role: body.role,
          status: "pending",
        },
      },
    });

    if (error) throw error;

    return Response.json(user);
  } catch (error) {
    console.error("Error in auth operation:", error);
    return Response.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const supabase = await createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    return Response.json({ session });
  } catch (error) {
    console.error("Error getting session:", error);
    return Response.json({ error: "Failed to get session" }, { status: 500 });
  }
}
