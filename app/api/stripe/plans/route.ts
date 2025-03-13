import { NextResponse } from "next/server";
import { getAvailablePlans } from "@/app/(protected)/Companies/stripe-actions";

export async function GET() {
  try {
    const { plans } = await getAvailablePlans();
    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription plans" },
      { status: 500 }
    );
  }
}
