import { NextResponse } from "next/server";
import { generatePayroll } from "@/app/(protected)/Paychecks/lib/payroll-generator";

export async function GET(request: Request) {
  try {
    // Check for cron secret to ensure this is a legitimate cron request
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await generatePayroll();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Failed to generate payroll" },
      { status: 500 }
    );
  }
}
