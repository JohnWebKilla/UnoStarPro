import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getUserSessions,
  deleteUserSessions,
} from "@/lib/redis-session";

export async function POST(req: NextRequest) {
  try {
    // Create a new session
    const body = await req.json();
    const { userId, userData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Create a session with the provided data
    const sessionId = await createSession(userId, userData || {});

    return NextResponse.json({
      success: true,
      sessionId,
      message: "Session created successfully",
    });
  } catch (error: any) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");

    // If sessionId is provided, get that specific session
    if (sessionId) {
      const session = await getSession(sessionId);

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session,
      });
    }

    // If userId is provided, get all sessions for that user
    if (userId) {
      const sessionIds = await getUserSessions(userId);

      // Get details for each session
      const sessions = [];
      for (const id of sessionIds) {
        const session = await getSession(id);
        if (session) {
          sessions.push({
            id,
            ...session,
          });
        }
      }

      return NextResponse.json({
        success: true,
        userId,
        sessionCount: sessions.length,
        sessions,
      });
    }

    return NextResponse.json(
      { error: "Either sessionId or userId is required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Session retrieval error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve session" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, data } = body;

    if (!sessionId || !data) {
      return NextResponse.json(
        { error: "Session ID and data are required" },
        { status: 400 }
      );
    }

    const success = await updateSession(sessionId, data);

    if (!success) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Session updated successfully",
    });
  } catch (error: any) {
    console.error("Session update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update session" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");

    if (!sessionId && !userId) {
      return NextResponse.json(
        { error: "Either sessionId or userId is required" },
        { status: 400 }
      );
    }

    if (sessionId) {
      // Delete a specific session
      const success = await deleteSession(sessionId);

      return NextResponse.json({
        success,
        message: success
          ? "Session deleted successfully"
          : "Session not found or already deleted",
      });
    } else if (userId) {
      // Delete all sessions for a user
      const deletedCount = await deleteUserSessions(userId);

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `${deletedCount} sessions deleted for user`,
      });
    }
  } catch (error: any) {
    console.error("Session deletion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete session" },
      { status: 500 }
    );
  }
}
