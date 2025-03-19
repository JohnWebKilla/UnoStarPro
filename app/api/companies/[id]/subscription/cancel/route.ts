import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cancelSubscription } from "@/app/(protected)/Companies/stripe-actions";
import { revalidatePath } from "next/cache";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { params } = context;
    const companyId = parseInt(params.id, 10);

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: "Invalid company ID" },
        { status: 400 }
      );
    }

    // Get options from the request body
    const {
      atPeriodEnd = true,
      issueRefund = false,
      updateStatus = true,
    } = await request.json();

    console.log(
      `Cancelling subscription for company ${companyId} with options:`,
      {
        atPeriodEnd,
        issueRefund,
        updateStatus,
      }
    );

    // Get the company from the database
    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("stripe_subscription_id, status")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!company.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Company does not have an active subscription" },
        { status: 400 }
      );
    }

    console.log(
      `Cancelling subscription ${company.stripe_subscription_id} with options:`,
      {
        atPeriodEnd,
        issueRefund,
      }
    );

    // Cancel the subscription with the provided options
    const result = await cancelSubscription({
      subscriptionId: company.stripe_subscription_id,
      atPeriodEnd,
      issueRefund,
    });

    // Update database fields based on cancellation options
    const updateFields: any = {};

    // If cancelling immediately (not at period end), update subscription fields
    if (!atPeriodEnd) {
      updateFields.stripe_subscription_id = null;
      updateFields.subscription_status = "canceled";
      updateFields.subscription_amount = 0;
    } else {
      // If cancelling at period end, just update the subscription status
      updateFields.subscription_status = "scheduled_for_cancellation";
    }

    // Always update the last synced timestamp
    updateFields.last_synced_at = new Date().toISOString();

    // Update company status to inactive if requested and not already inactive
    if (updateStatus && company.status !== "inactive") {
      updateFields.status = "inactive";
    }

    console.log("Updating company with fields:", updateFields);

    // Update the company in the database
    const { error: updateError } = await supabase
      .from("companies")
      .update(updateFields)
      .eq("id", companyId);

    if (updateError) {
      console.error("Error updating company:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update company record",
          details: updateError.message,
          subscription: result, // Still return subscription result
        },
        { status: 500 }
      );
    }

    // Revalidate the Companies page
    revalidatePath("/Companies");

    return NextResponse.json({
      success: true,
      message: atPeriodEnd
        ? "Subscription will be canceled at the end of the current billing period"
        : "Subscription has been canceled immediately",
      companyUpdated: updateStatus
        ? "Company status set to inactive"
        : "Company status unchanged",
      subscription: result,
    });
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
