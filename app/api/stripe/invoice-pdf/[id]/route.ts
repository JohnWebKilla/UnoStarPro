import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const invoiceId = resolvedParams.id;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // Retrieve the invoice to get the PDF URL
    const invoice = await stripe.invoices.retrieve(invoiceId);

    if (!invoice.invoice_pdf) {
      return NextResponse.json(
        { error: "Invoice PDF not available" },
        { status: 404 }
      );
    }

    // Redirect to the PDF URL
    return NextResponse.redirect(invoice.invoice_pdf);
  } catch (error) {
    console.error("Error fetching invoice PDF:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice PDF" },
      { status: 500 }
    );
  }
}
