import { NextRequest, NextResponse } from "next/server";
import { debugPaymentMethods } from "@/app/(protected)/Companies/debug-payment-methods";

export async function GET(
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
