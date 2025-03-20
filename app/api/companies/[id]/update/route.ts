import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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

    // Get the update data from the request body
    const updateData = await request.json();

    // Fix column names to match database schema
    if (updateData.stripe_subscription_amount !== undefined) {
      updateData.subscription_amount = updateData.stripe_subscription_amount;
      delete updateData.stripe_subscription_amount;
    }

    console.log(`Updating company ${companyId} with data:`, updateData);

    // Get the company from the database
    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      console.error("Company not found:", companyError);
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Update the company in the database
    const { data: updatedCompany, error: updateError } = await supabase
      .from("companies")
      .update(updateData)
      .eq("id", companyId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating company:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update company record",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Log the update for debugging
    if (updateData.subscription_amount !== undefined) {
      console.log(
        `Updated company ${companyId} subscription amount to: ${updateData.subscription_amount}`
      );
    }

    if (updateData.stripe_subscription_id !== undefined) {
      console.log(
        `Updated company ${companyId} subscription ID to: ${updateData.stripe_subscription_id}`
      );
    }

    if (updateData.subscription_status !== undefined) {
      console.log(
        `Updated company ${companyId} subscription status to: ${updateData.subscription_status}`
      );
    }

    // Revalidate the Companies page
    revalidatePath("/Companies");

    return NextResponse.json({
      success: true,
      message: "Company updated successfully",
      company: updatedCompany,
      updated_values: updateData,
    });
  } catch (error: any) {
    console.error("Error updating company:", error);
    return NextResponse.json(
      {
        error: "Failed to update company",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
