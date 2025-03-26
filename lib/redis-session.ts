import { getRedisClient } from "./redis";
import { v4 as uuidv4 } from "uuid";

// Default session expiration time (24 hours)
const DEFAULT_SESSION_EXPIRY = 24 * 60 * 60;

/**
 * Creates a new session in Redis
 *
 * @param userId - User ID to associate with the session
 * @param data - Session data to store
 * @param expiryInSeconds - Session expiration time in seconds
 * @returns Session ID
 */
export async function createSession(
  userId: string,
  data: Record<string, any>,
  expiryInSeconds: number = DEFAULT_SESSION_EXPIRY
): Promise<string> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }

  // Generate a unique session ID
  const sessionId = uuidv4();

  // Create session object with metadata
  const sessionData = {
    userId,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    ...data,
  };

  // Store session in Redis
  const sessionKey = `session:${sessionId}`;
  await redis.set(
    sessionKey,
    JSON.stringify(sessionData),
    "EX",
    expiryInSeconds
  );

  // Create a user-to-sessions index for lookup
  const userSessionsKey = `user-sessions:${userId}`;
  await redis.sadd(userSessionsKey, sessionId);

  return sessionId;
}

/**
 * Gets session data from Redis
 *
 * @param sessionId - Session ID to retrieve
 * @returns Session data or null if not found
 */
export async function getSession<T = Record<string, any>>(
  sessionId: string
): Promise<T | null> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }

  const sessionKey = `session:${sessionId}`;

  // Get session data
  const sessionData = await redis.get(sessionKey);
  if (!sessionData) return null;

  try {
    // Parse session data
    const session = JSON.parse(sessionData.toString()) as T;

    // Update last accessed timestamp
    const updatedSession = {
      ...session,
      lastAccessed: new Date().toISOString(),
    };

    // Get the remaining TTL
    const ttl = await redis.ttl(sessionKey);
    if (ttl > 0) {
      // Update the session with the new timestamp
      await redis.set(sessionKey, JSON.stringify(updatedSession), "EX", ttl);
    }

    return updatedSession;
  } catch (error) {
    console.error("Error parsing session data:", error);
    return null;
  }
}

/**
 * Updates session data in Redis
 *
 * @param sessionId - Session ID to update
 * @param data - New session data
 * @returns Success status
 */
export async function updateSession(
  sessionId: string,
  data: Record<string, any>
): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }

  const sessionKey = `session:${sessionId}`;

  // Get current session
  const currentSessionData = await redis.get(sessionKey);
  if (!currentSessionData) return false;

  try {
    // Parse current session
    const currentSession = JSON.parse(currentSessionData.toString());

    // Merge with new data
    const updatedSession = {
      ...currentSession,
      ...data,
      lastAccessed: new Date().toISOString(),
    };

    // Get the remaining TTL
    const ttl = await redis.ttl(sessionKey);
    if (ttl > 0) {
      // Update the session with the merged data
      await redis.set(sessionKey, JSON.stringify(updatedSession), "EX", ttl);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error updating session:", error);
    return false;
  }
}

/**
 * Deletes a session from Redis
 *
 * @param sessionId - Session ID to delete
 * @returns Success status
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }

  const sessionKey = `session:${sessionId}`;

  // Get session to find user ID
  const sessionData = await redis.get(sessionKey);
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData.toString());
      const userId = session.userId;

      // Remove session from user's sessions set
      if (userId) {
        const userSessionsKey = `user-sessions:${userId}`;
        await redis.srem(userSessionsKey, sessionId);
      }
    } catch (error) {
      console.error("Error parsing session during deletion:", error);
    }
  }

  // Delete the session
  const result = await redis.del(sessionKey);
  return result === 1;
}

/**
 * Gets all active sessions for a user
 *
 * @param userId - User ID to get sessions for
 * @returns Array of session IDs
 */
export async function getUserSessions(userId: string): Promise<string[]> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }

  const userSessionsKey = `user-sessions:${userId}`;

  // Get all session IDs for the user
  const sessionIds = await redis.smembers(userSessionsKey);
  return sessionIds;
}

/**
 * Deletes all sessions for a user
 *
 * @param userId - User ID to delete sessions for
 * @returns Number of sessions deleted
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error("Redis client not initialized");
  }

  const userSessionsKey = `user-sessions:${userId}`;

  // Get all session IDs for the user
  const sessionIds = await redis.smembers(userSessionsKey);

  if (sessionIds.length === 0) return 0;

  // Delete each session
  let deletedCount = 0;
  for (const sessionId of sessionIds) {
    const sessionKey = `session:${sessionId}`;
    const deleted = await redis.del(sessionKey);
    if (deleted === 1) deletedCount++;
  }

  // Delete the user's sessions set
  await redis.del(userSessionsKey);

  return deletedCount;
}
