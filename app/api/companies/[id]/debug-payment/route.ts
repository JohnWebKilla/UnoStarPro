import { NextRequest, NextResponse } from "next/server";
import { debugPaymentMethods } from "@/app/(protected)/Companies/debug-payment-methods";

// Using the same structure as other working dynamic routes
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const companyId = parseInt(context.params.id, 10);

    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: "Invalid company ID" },
        { status: 400 }
      );
    }

    // Run the debug function
    const result = await debugPaymentMethods(companyId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in debug payment API:", error);
    return NextResponse.json(
      { error: "An error occurred while debugging payment methods" },
      { status: 500 }
    );
  }
}
