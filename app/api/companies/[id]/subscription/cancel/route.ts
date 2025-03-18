import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cancelSubscription } from "@/app/(protected)/Companies/stripe-actions";
import { revalidatePath } from "next/cache";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id, 10);

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: "Invalid company ID" },
        { status: 400 }
      );
    }

    // Get options from the request body
    const { atPeriodEnd = true, issueRefund = false } = await request.json();

    // Get the company from the database
    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("stripe_subscription_id")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!company.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Company does not have an active subscription" },
        { status: 400 }
      );
    }

    // Cancel the subscription with the provided options
    const result = await cancelSubscription({
      subscriptionId: company.stripe_subscription_id,
      atPeriodEnd,
      issueRefund,
    });

    // Update the company in the database if cancelled immediately
    if (!atPeriodEnd) {
      await supabase
        .from("companies")
        .update({
          stripe_subscription_id: null,
          subscription_status: "canceled",
          subscription_amount: 0,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", companyId);
    }

    // Revalidate the Companies page
    revalidatePath("/Companies");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error cancelling subscription:", error);

    return NextResponse.json(
      {
        error: "Failed to cancel subscription",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
