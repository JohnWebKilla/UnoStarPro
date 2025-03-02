import { NextResponse } from "next/server";
import { connectCompanyToStripe } from "@/app/api/webhooks/stripe/route";

export async function POST(
  request: Request,
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

    const result = await connectCompanyToStripe(companyId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error connecting company to Stripe:", {
      error,
      companyId: params.id,
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
