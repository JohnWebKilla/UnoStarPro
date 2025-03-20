import { NextResponse } from "next/server";
import Stripe from "stripe";
import JSZip from "jszip";
import { createClient } from "@/utils/supabase/server";

// Initialize Stripe only if API key is available
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    })
  : null;

export async function POST(request: Request) {
  try {
    // Check if Stripe is initialized
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe API is not configured" },
        { status: 500 }
      );
    }

    let companyId: number | string;

    // Check content type to handle both JSON and form data
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Handle JSON request
      const body = await request.json();
      companyId = body.companyId;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      // Handle form data
      const formData = await request.formData();
      companyId = formData.get("companyId") as string;
    } else {
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // Get company details
    const supabase = await createClient();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("stripe_customer_id")
      .eq("id", companyId)
      .single();

    if (companyError || !company?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Company not found or not connected to Stripe" },
        { status: 404 }
      );
    }

    // Get all invoices for the customer
    const invoices = await stripe.invoices.list({
      customer: company.stripe_customer_id,
      limit: 100,
    });

    if (invoices.data.length === 0) {
      return NextResponse.json(
        { error: "No invoices found for this company" },
        { status: 404 }
      );
    }

    // Create a new ZIP file
    const zip = new JSZip();

    // Add each invoice PDF to the ZIP file
    const fetchPromises = invoices.data.map(async (invoice) => {
      if (invoice.invoice_pdf) {
        try {
          const response = await fetch(invoice.invoice_pdf);
          const pdfBuffer = await response.arrayBuffer();

          // Use invoice number or ID for the filename
          const fileName = `Invoice_${invoice.number || invoice.id}.pdf`;
          zip.file(fileName, pdfBuffer);

          return true;
        } catch (error) {
          console.error(`Error fetching invoice PDF ${invoice.id}:`, error);
          return false;
        }
      }
      return false;
    });

    await Promise.all(fetchPromises);

    // Generate the ZIP file
    const zipContent = await zip.generateAsync({ type: "arraybuffer" });

    // Return the ZIP file
    return new NextResponse(zipContent, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="invoices_${companyId}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error downloading invoices:", error);
    return NextResponse.json(
      { error: "Failed to download invoices" },
      { status: 500 }
    );
  }
}
