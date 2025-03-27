/**
 * Checks if an API route exists by making a HEAD request
 * @param url The URL to check
 * @returns A boolean indicating if the route exists
 */
export async function checkApiRoute(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // Consider both 200 and 401 as valid routes (401 means route exists but needs auth)
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}
