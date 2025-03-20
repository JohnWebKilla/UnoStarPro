import { NextRequest, NextResponse } from "next/server";
import { connectCompanyToStripe } from "@/app/api/webhooks/stripe/route";

export async function POST(request: Request) {
  // Extract ID from URL path using a simple split approach
  const pathParts = new URL(request.url).pathname.split("/");
  const id = pathParts[pathParts.indexOf("companies") + 2];

  try {
    const companyId = parseInt(id, 10);
    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: "Invalid company ID" },
        { status: 400 }
      );
    }

    const result = await connectCompanyToStripe(companyId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error connecting company to Stripe:", {
      error,
      companyId: id,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to connect company to Stripe",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
