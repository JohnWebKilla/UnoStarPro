import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache, deleteCache } from "@/lib/redis";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Cache key is required" },
        { status: 400 }
      );
    }

    const data = await getCache(key);
    return NextResponse.json({ data, source: data ? "cache" : "database" });
  } catch (error) {
    console.error("Error in cache GET:", error);
    return NextResponse.json({ error: "Failed to get cache" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, expiryInSeconds = 300 } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Cache key and value are required" },
        { status: 400 }
      );
    }

    await setCache(key, value, expiryInSeconds);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in cache POST:", error);
    return NextResponse.json({ error: "Failed to set cache" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Cache key is required" },
        { status: 400 }
      );
    }

    await deleteCache(key);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in cache DELETE:", error);
    return NextResponse.json(
      { error: "Failed to delete cache" },
      { status: 500 }
    );
  }
}
