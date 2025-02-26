import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

// Rate limit configuration: 5 requests per minute
const RATE_LIMIT_CONFIG = {
  limit: 5,
  windowInSeconds: 60,
  identifier: "api-example",
};

export async function GET(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(req, RATE_LIMIT_CONFIG);

  // If rate limit exceeded, return the error response
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Process the request normally
  return NextResponse.json({
    message: "This is a rate-limited API endpoint",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(req, RATE_LIMIT_CONFIG);

  // If rate limit exceeded, return the error response
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Parse the request body
    const body = await req.json();

    // Process the request normally
    return NextResponse.json({
      message: "Data received successfully",
      data: body,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }
}
