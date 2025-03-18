import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();

    // Get all companies
    const { data: companies, error: fetchError } = await supabase
      .from("companies")
      .select("*");

    if (fetchError) {
      console.error("Error fetching companies:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch companies" },
        { status: 500 }
      );
    }

    // Update each company with default values if they don't have subscription_status
    for (const company of companies) {
      if (!company.subscription_status) {
        const { error: updateError } = await supabase
          .from("companies")
          .update({
            subscription_status: company.stripe_subscription_id
              ? "active"
              : null,
            last_invoice_status: null,
            last_invoice_date: null,
          })
          .eq("id", company.id);

        if (updateError) {
          console.error(`Error updating company ${company.id}:`, updateError);
          continue;
        }
      }
    }

    // Trigger a sync with Stripe to update all statuses
    const syncResponse = await fetch(
      "http://localhost:3000/api/companies/sync",
      {
        method: "POST",
      }
    );

    if (!syncResponse.ok) {
      console.error("Error syncing with Stripe:", await syncResponse.text());
      return NextResponse.json(
        { error: "Failed to sync with Stripe" },
        { status: 500 }
      );
    }

    const syncResult = await syncResponse.json();
    return NextResponse.json({ success: true, syncResult });
  } catch (error) {
    console.error("Error in migration:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
