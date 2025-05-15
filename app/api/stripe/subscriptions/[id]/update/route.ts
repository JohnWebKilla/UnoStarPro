import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Create a redirect response to the new API endpoint
  console.log(
    `Redirecting subscription update from dynamic route to new endpoint. ID: ${params.id}`
  );

  try {
    // Get the original request body
    const body = await request.json();

    // Create a new request to the new endpoint with the subscription ID added to the body
    const newBody = {
      ...body,
      subscriptionId: params.id,
    };

    // Make a request to the new endpoint
    const response = await fetch(
      new URL("/api/stripe/subscriptions/update", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newBody),
      }
    );

    // Return the response from the new endpoint
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error redirecting subscription update:", error);
    return NextResponse.json(
      {
        error: "Failed to process subscription update",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
