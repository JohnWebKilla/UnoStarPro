import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = params.id;
    const supabase = await createClient();

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!company.stripe_customer_id) {
      return NextResponse.json(
        { error: "Company not connected to Stripe" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { auto_charge } = body;

    // Create invoice in Stripe
    const invoice = await stripe.invoices.create({
      customer: company.stripe_customer_id,
      auto_advance: true, // Automatically finalize and pay the invoice if possible
      collection_method: auto_charge ? "charge_automatically" : "send_invoice",
      days_until_due: auto_charge ? undefined : 30,
    });

    // If auto-charging, attempt to pay the invoice immediately
    if (auto_charge) {
      await stripe.invoices.pay(invoice.id);
    } else {
      // Just finalize the invoice without charging
      await stripe.invoices.finalizeInvoice(invoice.id);
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
