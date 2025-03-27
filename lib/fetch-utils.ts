import { createClient } from "@/utils/supabase/client";

/**
 * Fetches data from an API endpoint with authentication
 * @param url The URL to fetch from
 * @returns The JSON response data or null if there was an error
 */
export async function fetchWithAuth(url: string): Promise<any> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.error("No active session found");
      return null;
    }

    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    // Don't throw on 404, just return null
    if (res.status === 404) {
      console.log(`API route not found: ${url}`);
      return null;
    }

    // For 401, try to refresh the session
    if (res.status === 401) {
      console.log(
        `Unauthorized access to ${url}, attempting to refresh session...`
      );
      const {
        data: { session: refreshedSession },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        console.error("Failed to refresh session:", refreshError);
        return null;
      }

      // Retry the original request with the new token
      const retryRes = await fetch(url, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshedSession.access_token}`,
        },
      });

      if (retryRes.ok) {
        return await retryRes.json();
      }

      console.error(`Failed to fetch data after session refresh for ${url}`);
      return null;
    }

    // For other errors, throw
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Attempts to refresh the session using Supabase client
 * @returns true if successful, false otherwise
 */
async function refreshSession(): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();

    if (error || !session) {
      console.error("Failed to refresh session:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to refresh session:", error);
    return false;
  }
}
