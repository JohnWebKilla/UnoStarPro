import { NextRequest, NextResponse } from "next/server";
import { flushCache } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    await flushCache();
    return NextResponse.json({
      success: true,
      message: "Cache cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to clear cache",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
